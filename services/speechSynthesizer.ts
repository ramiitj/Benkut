// Gemini Native Audio Player & Synthesizer
// Uses Web Audio API to play 24kHz PCM / Audio Buffer from Gemini Model TTS
// Exclusively routes playback through Web Audio, terminating any concurrent browser speech synthesis.

export interface GeminiAudioOptions {
  audioData?: string | null; // base64 encoded PCM or audio chunk from Gemini
  sampleRate?: number;
  voiceGender?: 'female' | 'male';
  voiceName?: string;
  language?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Thoroughly sanitizes text before speech synthesis:
 * Removes markdown headings, asterisks, bold/italics, backticks, code blocks,
 * html tags, markdown links/images, table markers, and special symbols.
 */
export function sanitizeSpokenText(text: string): string {
  if (!text) return '';
  return text
    // Strip markdown code blocks ```json ... ``` or ``` ... ```
    .replace(/```[\s\S]*?```/g, '')
    // Strip inline code `code`
    .replace(/`([^`]+)`/g, '$1')
    // Strip markdown image syntax ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    // Convert markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove HTML tags <...>
    .replace(/<[^>]*>/g, '')
    // Remove markdown headers #, ##, ### at start of lines
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italics asterisks & underscores **text**, *text*, __text__, _text_
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove strikethrough ~~text~~
    .replace(/~~(.*?)~~/g, '$1')
    // Remove blockquotes >
    .replace(/^>\s+/gm, '')
    // Remove bullet list markers -, *, + at line starts
    .replace(/^[-*+]\s+/gm, '')
    // Remove table pipes |
    .replace(/\|/g, ' ')
    // Remove urls
    .replace(/https?:\/\/\S+/g, '')
    // Remove extraneous json braces or stray brackets
    .replace(/[{}[\]]/g, '')
    // Collapse multiple whitespaces and newlines into single spaces
    .replace(/\s+/g, ' ')
    .trim();
}

class GeminiAudioSynthesizer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isSpeaking = false;
  private lastSpokenText = '';
  public isMuted = false;
  public voiceGender: 'female' | 'male' = 'female';
  public voiceName: string = 'Kore'; // 'Kore' (female) or 'Puck' (male)

  constructor() {
    // Lazy init AudioContext on first user interaction
    if (typeof window !== 'undefined') {
      const savedGender = localStorage.getItem('benkut_voice_gender');
      if (savedGender === 'male' || savedGender === 'female') {
        this.voiceGender = savedGender;
        this.voiceName = savedGender === 'male' ? 'Puck' : 'Kore';
      }
    }
  }

  public setVoiceGender(gender: 'female' | 'male') {
    this.voiceGender = gender;
    this.voiceName = gender === 'male' ? 'Puck' : 'Kore';
    if (typeof window !== 'undefined') {
      localStorage.setItem('benkut_voice_gender', gender);
    }
  }

  public getVoiceGender(): 'female' | 'male' {
    return this.voiceGender;
  }

  public unlockAudio() {
    try {
      if (!this.audioContext && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx({ sampleRate: 24000 });
        }
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
    } catch (e) {
      console.warn('AudioContext unlock notice:', e);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioContext && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx({ sampleRate: 24000 });
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  // Converts base64 PCM 16-bit 24kHz or Audio buffer to AudioBuffer
  private async decodeBase64Pcm(base64Data: string, sampleRate = 24000): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    if (!ctx) throw new Error('AudioContext not available');

    // Decode base64 to binary
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check if it's already encoded container (e.g. WAV/MP3 header) or raw PCM
    try {
      // First try standard native decodeAudioData
      const bufferCopy = bytes.buffer.slice(0);
      return await ctx.decodeAudioData(bufferCopy);
    } catch {
      // Raw 16-bit PCM little-endian fallback (Gemini Native Audio stream)
      const int16Array = new Int16Array(bytes.buffer);
      const audioBuffer = ctx.createBuffer(1, int16Array.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < int16Array.length; i++) {
        // Normalize 16-bit signed integer to Float32 [-1.0, 1.0]
        channelData[i] = int16Array[i] / 32768.0;
      }
      return audioBuffer;
    }
  }

  // Terminate any concurrent browser speech synthesis
  private killBrowserSpeechSynthesis() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  // Plays Gemini Model Native Audio exclusively via 24kHz PCM stream
  public async playGeminiAudio(base64Data: string, sampleRate = 24000, options: GeminiAudioOptions = {}): Promise<void> {
    if (this.isMuted) return;
    
    // Stop any existing audio & terminate browser speech synthesis
    this.stop();
    this.killBrowserSpeechSynthesis();
    this.unlockAudio();

    const ctx = this.getAudioContext();
    if (!ctx) {
      options.onError?.('Web Audio unavailable');
      return;
    }

    try {
      const audioBuffer = await this.decodeBase64Pcm(base64Data, sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      this.currentSource = source;
      this.isSpeaking = true;
      options.onStart?.();

      source.onended = () => {
        if (this.currentSource === source) {
          this.isSpeaking = false;
          this.currentSource = null;
          options.onEnd?.();
        }
      };

      source.start(0);
    } catch (err) {
      console.warn('Error playing Gemini native audio buffer:', err);
      this.isSpeaking = false;
      options.onError?.(err);
    }
  }

  // Speaks using Gemini 24kHz TTS stream (or provided audioData)
  public async speakText(text: string, options: GeminiAudioOptions = {}): Promise<void> {
    if (this.isMuted) return;

    const cleanText = sanitizeSpokenText(text);
    if (!cleanText) return;
    this.lastSpokenText = cleanText;

    // Immediately cancel any browser speech synthesis
    this.killBrowserSpeechSynthesis();

    // If base64 audio is already attached in options (from generateAgentTurn), play directly!
    if (options.audioData) {
      return this.playGeminiAudio(options.audioData, options.sampleRate || 24000, options);
    }

    // Otherwise request TTS from Gemini 24kHz PCM server endpoint
    try {
      this.unlockAudio();
      const res = await fetch('/api/agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceGender: options.voiceGender || this.voiceGender,
          voiceName: options.voiceName || this.voiceName,
          language: options.language || 'English'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioData) {
          return this.playGeminiAudio(data.audioData, data.sampleRate || 24000, options);
        }
      }
    } catch (err) {
      console.warn('Gemini TTS fetch notice:', err);
    }

    // Fallback: browser speech if Gemini Audio stream unavailable
    this.fallbackBrowserSpeak(cleanText, options);
  }

  private fallbackBrowserSpeak(text: string, options: GeminiAudioOptions = {}) {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.killBrowserSpeechSynthesis();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => {
        this.isSpeaking = true;
        options.onStart?.();
      };
      utterance.onend = () => {
        this.isSpeaking = false;
        options.onEnd?.();
      };
      utterance.onerror = (e) => {
        this.isSpeaking = false;
        options.onError?.(e);
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Browser speech fallback notice:', e);
    }
  }

  public stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }
    this.killBrowserSpeechSynthesis();
    this.isSpeaking = false;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getLastSpokenText(): string {
    return this.lastSpokenText;
  }
}

export const speechSynthesizer = new GeminiAudioSynthesizer();

