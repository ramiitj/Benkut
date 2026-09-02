import { GoogleGenAI, Modality } from '@google/genai';
import { buildCombinedSystemInstruction, getSystemPrompts } from './prompt-store.mjs';

let aiClient = null;

// The model chooses what goes into memoryNote, and it's replayed verbatim
// into every future turn's system context once stored - a second-order
// prompt-injection surface (a manipulated image, a crafted spoken phrase,
// or a poisoned RAG-style source could try to get an instruction smuggled
// into "durable memory" instead of just this one reply). Bound and screen
// it the same way governance.mjs's filterRag screens untrusted content.
const MEMORY_NOTE_MAX_LENGTH = 200;
const INJECTION_PATTERN = /(ignore (all|any|previous|prior) instructions|system prompt|you are now|disregard (all|previous|prior)|new instructions?:)/i;
function sanitizeMemoryNote(note) {
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  if (!trimmed || trimmed.length > MEMORY_NOTE_MAX_LENGTH || INJECTION_PATTERN.test(trimmed)) return null;
  return trimmed;
}

// autoTabulatedItems drives unconfirmed writes straight to a user's
// pantry/shopping Firestore data (see the "Autonomous Tabulation" design
// in prompt-store.mjs) - nothing between the model's output and that write
// currently validates shape or bounds, so a manipulated image or a
// successful injection could otherwise write arbitrary junk. Constrain to
// the same enums the client/schema already document.
const ALLOWED_CATEGORIES = ['produce', 'dairy', 'bakery', 'protein', 'pantry', 'spice'];
const ALLOWED_STORAGE = ['pantry', 'refrigerator', 'freezer', 'counter'];
const ALLOWED_FRESHNESS = ['fresh', 'use-soon', 'use-first', 'possibly-deteriorating', 'expired'];
const ALLOWED_TARGET = ['pantry', 'shopping'];
function sanitizeAutoTabulatedItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 10).map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return null;
    const quantity = Number(item.quantity);
    return {
      name: item.name.trim().slice(0, 80),
      quantity: Number.isFinite(quantity) && quantity > 0 && quantity <= 1000 ? quantity : 1,
      unit: typeof item.unit === 'string' ? item.unit.trim().slice(0, 20) || 'each' : 'each',
      category: ALLOWED_CATEGORIES.includes(item.category) ? item.category : 'pantry',
      storageLocation: ALLOWED_STORAGE.includes(item.storageLocation) ? item.storageLocation : 'refrigerator',
      freshnessStatus: ALLOWED_FRESHNESS.includes(item.freshnessStatus) ? item.freshnessStatus : 'fresh',
      target: ALLOWED_TARGET.includes(item.target) ? item.target : 'pantry'
    };
  }).filter(Boolean);
}

function getAIClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw Object.assign(new Error('The voice agent is not configured. Set GEMINI_API_KEY on the server.'), { status: 503 });
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

const cleanJson = (text) => {
  if (!text) {
    throw Object.assign(new Error('Provider returned an empty response'), { status: 502 });
  }
  
  // Strip Markdown code block indicators
  let cleaned = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  
  if (!match) {
    return {
      speech: text.trim().replace(/[*#_`]/g, ''),
      intent: 'general',
      workspace: {
        title: 'Kitchen Assistant',
        body: text.trim()
      }
    };
  }
  
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    console.error('Failed to parse Gemini JSON:', err.message, 'Raw text:', text);
    let aggressive = match[0].replace(/,\s*([}\]])/g, '$1'); 
    try {
      return JSON.parse(aggressive);
    } catch (err2) {
       console.error('Aggressive fallback failed:', err2.message);
       return {
         speech: 'I understand what you mean. Let me know how you would like to proceed in your kitchen.',
         intent: 'general',
         workspace: {
           title: 'Kitchen Companion',
           body: text.replace(/[{}[\]"]/g, '').trim() || 'Ready for next step.'
         }
       };
    }
  }
};

function sanitizeModel(model) {
  if (!model || model.includes('gemini-2.') || model.includes('gemini-1.') || model === 'gemini-pro') {
    return 'gemini-3.7-flash';
  }
  return model;
}

export function sanitizeSpokenText(text) {
  if (!text) return '';
  return text
    // Strip markdown code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Strip inline code
    .replace(/`([^`]+)`/g, '$1')
    // Strip markdown image syntax
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    // Convert markdown links
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italics asterisks & underscores
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove bullet list markers
    .replace(/^[-*+]\s+/gm, '')
    // Remove table pipes
    .replace(/\|/g, ' ')
    // Remove urls
    .replace(/https?:\/\/\S+/g, '')
    // Remove extraneous json braces or stray brackets
    .replace(/[{}[\]]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Generates Gemini native model voice audio (24kHz PCM)
export const generateGeminiSpeechAudio = async ({ text, voiceGender = 'female', voiceName = null }) => {
  if (!text || !text.trim()) return null;
  const ai = getAIClient();

  let selectedVoice = voiceName;
  if (!selectedVoice) {
    selectedVoice = voiceGender === 'male' ? 'Puck' : 'Kore';
  }

  try {
    const cleanSpoken = sanitizeSpokenText(text);
    if (!cleanSpoken) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: cleanSpoken }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return {
        audioData: base64Audio,
        sampleRate: 24000,
        voiceName: selectedVoice
      };
    }
    return null;
  } catch (err) {
    console.warn('Gemini TTS audio generation notice:', err?.message || err);
    return null;
  }
};

export const generateAgentTurn = async ({ prompt, history = [], context = {}, environment = 'countertop', image = null, specialist = null, language = 'English', bcp47 = 'en-US', voiceGender = 'female', voiceName = null, synthesizeSpeech = true, trigger = 'user', historySummary = '' }) => {
  const ai = getAIClient();
  const { config } = getSystemPrompts();
  const rawModel = config.model || process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const model = sanitizeModel(rawModel);

  const systemInstructionText = buildCombinedSystemInstruction(specialist, language, bcp47);

  const formattedHistory = history.slice(-12).map(turn => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(turn.text || '') }]
  }));

  const userParts = [];
  if (image && image.data && image.mimeType) {
    userParts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data
      }
    });
  }

  const envNames = {
    countertop: 'Kitchen Countertop (Live hands-free cooking & timer mode)',
    pantry: 'Home Pantry & Fridge (Inventory check, shelf scan & zero-waste mode)',
    supermarket: 'Supermarket & Grocery Aisle (Shopping list & basket mode)',
    farm_market: 'Farmers Market / Produce Stand (Freshness, ripeness & ethylene inspection mode)'
  };
  const envDescription = envNames[environment] || envNames.countertop;

  const contextPrompt = `Language: ${language} (${bcp47})\nActive Culinary Environment / Location: ${envDescription}\nCurrent Unified Core Memory & Kitchen State: ${JSON.stringify(context)}\nLong-Term Memory Notes (durable facts from earlier in this session): ${historySummary || 'None yet.'}\n${specialist ? `Active Focus Agent: ${specialist}\n` : ''}Turn Trigger: ${trigger}\n${trigger === 'proactive' ? 'No new user input this turn. Review the state and recent conversation above and decide whether to speak up per the PROACTIVE CHECK-INS directive.' : `User said/requested: ${prompt || 'Please inspect this photo.'}`}`;
  userParts.push({ text: contextPrompt });

  const contents = [...formattedHistory, { role: 'user', parts: userParts }];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemInstructionText,
      responseMimeType: 'application/json',
      temperature: config.temperature ?? 0.2,
      maxOutputTokens: config.maxOutputTokens ?? 1400
    }
  });

  const rawText = response.text || '';
  const parsed = cleanJson(rawText);

  // Clean speech text for conversational voice presentation. A proactive
  // check-in may deliberately have nothing to say (parsed.speech: null) -
  // only fall back to a generic reply for user-triggered turns, where an
  // empty "speech" is a provider slip rather than an intentional silence.
  const rawSpeech = typeof parsed.speech === 'string' ? parsed.speech.trim() : '';
  let spokenText = rawSpeech
    ? sanitizeSpokenText(rawSpeech)
    : (trigger === 'proactive' ? '' : sanitizeSpokenText('I heard you, how can I help next in your kitchen?'));

  let audioResult = null;
  if (synthesizeSpeech && spokenText) {
    audioResult = await generateGeminiSpeechAudio({
      text: spokenText,
      voiceGender,
      voiceName
    });
  }

  // Guarantee complete autonomous contract fields
  return {
    specialist: parsed.specialist || specialist || 'chef',
    language: parsed.language || bcp47 || 'en-US',
    speech: spokenText,
    audioData: audioResult?.audioData || null,
    audioSampleRate: audioResult?.sampleRate || 24000,
    voiceName: audioResult?.voiceName || null,
    intent: parsed.intent || (trigger === 'proactive' && !spokenText ? 'idle' : 'general'),
    pullScreen: parsed.pullScreen || parsed.foreground || null,
    cameraCommand: parsed.cameraCommand || null,
    foreground: parsed.foreground || parsed.pullScreen || null,
    returnToVoiceAfter: typeof parsed.returnToVoiceAfter === 'number' && parsed.returnToVoiceAfter > 0 ? parsed.returnToVoiceAfter : null,
    memoryNote: sanitizeMemoryNote(parsed.memoryNote),
    workspace: spokenText
      ? (parsed.workspace || { title: 'Kitchen Companion', body: spokenText })
      : (parsed.workspace || null),
    action: parsed.action || null,
    autoTabulatedItems: sanitizeAutoTabulatedItems(parsed.autoTabulatedItems),
    shelfAnalysis: parsed.shelfAnalysis || null,
    produceAnalysis: parsed.produceAnalysis || null,
    timer: parsed.timer || null,
    confirmationRequired: Boolean(parsed.confirmationRequired),
    feedbackPrompt: parsed.feedbackPrompt || null,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  };
};
