import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConsumerAccount } from '../services/consumerAccount';
import { getAuthSafe } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { foodMemoryService, mutationMeta } from '../services/foodMemoryService';
import { speechSynthesizer, sanitizeSpokenText } from '../services/speechSynthesizer';
import { telemetryService } from '../services/telemetryService';
import { CameraInspectionModal } from './CameraInspectionModal';
import { AuthModal } from './AuthModal';
import { AppTourModal } from './AppTourModal';
import { UserProfileModal } from './UserProfileModal';
import { SaveSessionModal } from './SaveSessionModal';
import { KitchenSettingsModal } from './KitchenSettingsModal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useLanguage, SupportedLanguage } from '../contexts/LanguageContext';
import {
  EnvironmentalGreetingEngine,
  CulinaryEnvironment,
  CULINARY_ENVIRONMENTS,
} from '../services/environmentalGreetingEngine';

const PROACTIVE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

type VoiceState = 'ready' | 'requesting' | 'listening' | 'understanding' | 'speaking' | 'paused' | 'unavailable' | 'error' | 'voiceUnavailable';
type OverlayView = 'pantry' | 'shopping' | 'cook' | null;

type ConversationTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

type AgentAction = {
  type: 'log_meal' | 'add_pantry' | 'update_pantry' | 'remove_pantry' | 'add_shopping' | 'remove_shopping' | 'update_habit' | 'produce_inspection' | 'auto_tabulate';
  label: string;
  payload: Record<string, unknown>;
};

interface ProduceAnalysisData {
  name: string;
  freshnessScore: number;
  ripeness: string;
  storageTip: string;
  culinaryUse: string;
  wastePreventionTip?: string;
}

interface AgentResult {
  specialist?: string;
  language?: string;
  speech: string;
  audioData?: string | null;
  audioSampleRate?: number;
  voiceName?: string | null;
  intent: string;
  pullScreen?: 'auth' | 'camera' | 'habits' | 'pantry' | 'shopping' | 'cook' | 'close' | 'voice' | null;
  cameraCommand?: 'open' | 'capture' | 'close' | null;
  foreground?: 'voice' | 'camera' | 'pantry' | 'shopping' | 'cook' | 'close' | null;
  returnToVoiceAfter?: number | null;
  memoryNote?: string | null;
  workspace: { title: string; body: string; data?: Record<string, unknown> } | null;
  action?: AgentAction | null;
  produceAnalysis?: ProduceAnalysisData | null;
  timer?: { label: string; durationSeconds: number } | null;
  confirmationRequired?: boolean;
  feedbackPrompt?: string | null;
  suggestions?: string[];
}

interface SpeechRecognitionEventLike { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }
interface SpeechRecognitionErrorLike { error: string }
interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

export const VoiceAgentShell: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, langInfo } = useLanguage();

  // Active Culinary Environment / Location State
  const [environment, setEnvironment] = useState<CulinaryEnvironment>(() => {
    try {
      const saved = localStorage.getItem('benkut_environment') as CulinaryEnvironment;
      return (saved && CULINARY_ENVIRONMENTS[saved]) ? saved : 'countertop';
    } catch {
      return 'countertop';
    }
  });
  const [showEnvSelector, setShowEnvSelector] = useState(false);

  // Environmental & Location-Adaptive Greeting Engine Helper
  const getEnvironmentalGreeting = useCallback((env: CulinaryEnvironment, lang: SupportedLanguage) => {
    const memoryState = foodMemoryService.getState();
    const userName = localStorage.getItem('benkut_display_name') || '';
    return EnvironmentalGreetingEngine.generateGreeting(env, lang, {
      userName,
      memoryState,
    });
  }, []);

  const stateLabels: Record<VoiceState, { label: string; sub: string }> = {
    ready: { label: t('voiceReady') || 'Ready on Countertop', sub: t('tapToSpeak') || 'Tap to speak' },
    requesting: { label: t('connecting') || 'Connecting...', sub: t('preparingVoice') || 'Preparing culinary assistant' },
    listening: { label: t('listening') || 'Listening hands-free...', sub: t('listeningHandsFree') || 'Listening hands-free' },
    understanding: { label: t('thinking') || 'Consulting your cooking coach...', sub: t('statusCalibratingCooking') || 'Analyzing kitchen context...' },
    speaking: { label: t('speaking') || 'Speaking...', sub: t('agentSpeaking') || 'Benkut speaking' },
    paused: { label: t('paused') || 'Paused', sub: t('tapToResume') || 'Tap to resume' },
    unavailable: { label: t('micUnavailable') || 'Mic unavailable', sub: t('enableMic') || 'Enable microphone permissions' },
    error: { label: t('couldNotHear') || 'Could not hear', sub: t('tapToRetry') || 'Tap to try again' },
    voiceUnavailable: { label: t('voiceUnavailableLabel') || 'Voice unavailable', sub: t('voiceUnavailableSub') || 'Reading the reply below instead' },
  };

  const recognition = useRef<RecognitionLike | null>(null);
  const isContinuousModeRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const returnToVoiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const isGreetingSpokenRef = useRef<boolean>(false);
  const lastSyncIssueNoticeRef = useRef<number>(0);

  // Core State
  const [voiceState, setVoiceState] = useState<VoiceState>('ready');
  const [transcript, setTranscript] = useState('');
  const [spokenReply, setSpokenReply] = useState(() => {
    const init = EnvironmentalGreetingEngine.generateGreeting(environment, language, {
      userName: localStorage.getItem('benkut_display_name') || '',
      memoryState: foodMemoryService.getState()
    });
    return init.fullSpokenText;
  });
  const [draft, setDraft] = useState('');
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [workspaceResult, setWorkspaceResult] = useState<{ title: string; body: string } | null>(null);
  const [produceCard, setProduceCard] = useState<ProduceAnalysisData | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<string | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState<string[]>(() => {
    const init = EnvironmentalGreetingEngine.generateGreeting(environment, language, {
      userName: localStorage.getItem('benkut_display_name') || '',
      memoryState: foodMemoryService.getState()
    });
    return init.suggestedActions;
  });
  
  // Contextual Visual Overlay (ONLY when active)
  const [activeOverlay, setActiveOverlay] = useState<OverlayView>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Sound & Voice Preferences
  const [isMuted, setIsMuted] = useState(() => speechSynthesizer.isMuted);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(() => speechSynthesizer.getVoiceGender());

  // Auth & Account
  const [account, setAccount] = useState<ConsumerAccount | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [, setMemoryVersion] = useState(0);

  const isGuest = !account || !account.uid || account.uid.startsWith('guest') || !account.storageConsent || account.email?.includes('guest@benkut.local');

  const refreshMemory = () => setMemoryVersion(v => v + 1);

  // Update initial greeting & suggestions when language or environment changes
  useEffect(() => {
    if (conversation.length === 0) {
      const init = getEnvironmentalGreeting(environment, language);
      setSpokenReply(init.fullSpokenText);
      setAgentSuggestions(init.suggestedActions);
    }
  }, [environment, language, getEnvironmentalGreeting, conversation.length]);

  const handleSelectEnvironment = useCallback((newEnv: CulinaryEnvironment) => {
    setEnvironment(newEnv);
    setShowEnvSelector(false);
    try {
      localStorage.setItem('benkut_environment', newEnv);
    } catch {}

    const res = getEnvironmentalGreeting(newEnv, language);
    if (conversation.length === 0) {
      setSpokenReply(res.fullSpokenText);
      setAgentSuggestions(res.suggestedActions);
    }
    speak(res.fullSpokenText);
    
    telemetryService.logEvent('environment_switch', {
      language,
      details: { environment: newEnv }
    });
  }, [conversation.length, getEnvironmentalGreeting, language]);

  const handleExitAttempt = () => {
    speechSynthesizer.stop();
    navigate('/');
  };

  const handleSaveAfterAuth = async (newAccount: ConsumerAccount) => {
    setAccount(newAccount);
    setShowSaveModal(false);
    setShowAuthModal(false);
    await foodMemoryService.syncWithCloud(newAccount.uid);
    telemetryService.logEvent('auth_success', {
      userId: newAccount.uid,
      userEmail: newAccount.email,
      language,
      details: { conversion: 'guest_to_registered_at_exit', turnCount: conversation.length }
    });
    speak('Your session and kitchen inventory have been saved to your account.');
  };

  const handleExitWithoutSaving = () => {
    setShowSaveModal(false);
    telemetryService.logEvent('session_exit_guest_unsaved', {
      userId: account?.uid || localStorage.getItem('benkut_user_id') || 'guest-session',
      userEmail: 'guest@benkut.local',
      language,
      details: { turnCount: conversation.length, reason: 'guest_exited_without_saving' }
    });
    speechSynthesizer.stop();
    navigate('/');
  };

  const scrollToBottom = useCallback(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [spokenReply, transcript, workspaceResult, produceCard, activeOverlay, scrollToBottom]);

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    speechSynthesizer.isMuted = nextState;
    if (nextState) speechSynthesizer.stop();
  };

  const handleClearSession = () => {
    setConversation([]);
    setPendingAction(null);
    setWorkspaceResult(null);
    setProduceCard(null);
    setActiveOverlay(null);
    setTranscript('');
    const init = getEnvironmentalGreeting(environment, language);
    setSpokenReply(init.fullSpokenText);
    setAgentSuggestions(init.suggestedActions);
    speak(init.fullSpokenText);
  };

  // Cooking Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => (s !== null && s > 1 ? s - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerActive(false);
      speak('Timer finished! Check your cooking.');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timerSeconds]);

  // Auth initialization
  useEffect(() => {
    try {
      const auth = getAuthSafe();
      if (!auth) {
        setAuthResolved(true);
        return;
      }
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setAccount({
            uid: user.uid,
            email: user.email || 'user@benkut.com',
            storageConsent: true,
            authenticatedAt: new Date().toISOString()
          });
          foodMemoryService.syncWithCloud(user.uid);
        } else {
          setAccount(null);
        }
        setAuthResolved(true);
      });
      return () => unsubscribe();
    } catch {
      setAuthResolved(true);
    }
  }, []);

  // Long-term memory notes now live in foodMemoryService's unified state
  // (domain/foodMemory.ts's memoryNotes field) instead of a separate
  // localStorage-only path, so they get the same Firestore sync/offline/
  // cross-device behavior as pantry/shopping/habits for free.
  const rememberNote = useCallback((note: string | null | undefined) => {
    if (!note) return;
    foodMemoryService.addMemoryNote(note);
  }, []);

  // Audio unlock listener
  useEffect(() => {
    const handleUnlock = () => speechSynthesizer.unlockAudio();
    window.addEventListener('click', handleUnlock, { once: true });
    window.addEventListener('touchstart', handleUnlock, { once: true });
    window.addEventListener('keydown', handleUnlock, { once: true });
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  const resumeListening = useCallback(() => {
    if (!isContinuousModeRef.current) return;
    if (speechSynthesizer.getIsSpeaking()) return;

    try {
      if (recognition.current) {
        recognition.current.start();
        setVoiceState('listening');
      }
    } catch {
      setVoiceState('listening');
    }
  }, []);

  const resetAutoSleepTimer = useCallback(() => {
    if (autoSleepTimerRef.current) clearTimeout(autoSleepTimerRef.current);
    if (!isContinuousModeRef.current) return;

    autoSleepTimerRef.current = setTimeout(() => {
      if (isContinuousModeRef.current && !speechSynthesizer.getIsSpeaking() && !isProcessingRef.current) {
        isContinuousModeRef.current = false;
        try { recognition.current?.stop(); } catch { /* ignore */ }
        setVoiceState('ready');
      }
    }, 28000);
  }, []);

  // The agent can ask to auto-return to the voice-first view after showing
  // an overlay/camera briefly (a quick confirmation, a short list glance).
  // Any new turn cancels a pending auto-return so it never fires mid-task.
  const scheduleReturnToVoice = useCallback((seconds: number) => {
    if (returnToVoiceTimerRef.current) clearTimeout(returnToVoiceTimerRef.current);
    returnToVoiceTimerRef.current = setTimeout(() => {
      setActiveOverlay(null);
      setShowCameraModal(false);
    }, Math.max(1, seconds) * 1000);
  }, []);

  const speak = useCallback((message: string, audioData?: string | null, onDone?: () => void) => {
    if (!message) {
      if (isContinuousModeRef.current) resumeListening();
      return;
    }

    setSpokenReply(message);

    if (isMuted) {
      setVoiceState('ready');
      onDone?.();
      return;
    }

    setVoiceState('speaking');

    try {
      recognition.current?.stop();
    } catch {
      // ignore
    }

    const cleanSpoken = sanitizeSpokenText(message);
    if (!cleanSpoken) {
      setVoiceState('ready');
      onDone?.();
      return;
    }

    speechSynthesizer.speakText(cleanSpoken, {
      audioData: audioData || null,
      voiceGender,
      language: langInfo.bcp47,
      onStart: () => {
        setVoiceState('speaking');
      },
      onEnd: () => {
        onDone?.();
        if (isContinuousModeRef.current) {
          setTimeout(() => {
            resumeListening();
            resetAutoSleepTimer();
          }, 300);
        } else {
          setVoiceState('ready');
        }
      },
      onError: () => {
        // Voice output genuinely failed - say so instead of quietly
        // reverting to "ready" as if nothing happened (the previous
        // behavior silently fell back to a different, jarring browser
        // voice instead; that fallback is gone, so this is now the only
        // signal the user gets that audio didn't play).
        setVoiceState('voiceUnavailable');
        setTimeout(() => {
          if (isContinuousModeRef.current) {
            resumeListening();
          } else {
            setVoiceState('ready');
          }
        }, 1800);
      }
    });
  }, [isMuted, voiceGender, langInfo.bcp47, resetAutoSleepTimer, resumeListening]);

  // Tell the user, in the agent's own voice, when a save didn't actually
  // succeed - foodMemoryService used to only console.warn this, so a
  // failed local save (data genuinely lost) or a failed cloud sync (safe
  // locally, just not backed up yet) looked identical to success. Throttle
  // so a burst of failed writes doesn't interrupt with the same notice
  // repeatedly.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ scope: 'local' | 'cloud'; message: string }>).detail;
      if (!detail) return;
      const now = Date.now();
      if (now - lastSyncIssueNoticeRef.current < 60000) return;
      lastSyncIssueNoticeRef.current = now;
      const notice = detail.scope === 'local'
        ? "I couldn't save that change on this device just now - please try again in a moment."
        : "I saved that on this device, but couldn't back it up to your account just now. I'll keep trying.";
      setConversation(turns => [
        ...turns,
        { id: crypto.randomUUID(), role: 'assistant', text: notice, timestamp: new Date().toLocaleTimeString() }
      ]);
      if (voiceState !== 'speaking' && voiceState !== 'listening') {
        speak(notice);
      }
    };
    window.addEventListener('benkut-sync-issue', handler);
    return () => window.removeEventListener('benkut-sync-issue', handler);
  }, [speak, voiceState]);

  // Speak the greeting as soon as we have an authenticated account, instead
  // of leaving it as a silent wall of text until the user taps the mic.
  // This still respects browser autoplay gating: reaching this screen with
  // an account always follows a real click (sign-in submit, or an existing
  // session's landing-page navigation), so the page has already had a user
  // gesture by the time this fires.
  useEffect(() => {
    if (account && conversation.length === 0 && !isGreetingSpokenRef.current) {
      isGreetingSpokenRef.current = true;
      speak(spokenReply);
    }
  }, [account, conversation.length, spokenReply, speak]);

  // Actually perform an agent-issued action against the pantry/shopping
  // store, and describe exactly what happened. Shared by two callers: an
  // action the model marks confirmationRequired (applied only after the
  // user says "yes", from the pending-action handler below) and an action
  // the model decides to apply immediately (from applyAgentResult) - found
  // via live testing that the latter case had NO handler at all, so the
  // model's own "I've removed the tomatoes" narration was a false claim:
  // nothing was actually removed, because result.action was only ever
  // consumed when confirmationRequired was also true.
  const executeAgentAction = (action: AgentAction): string => {
    const meta = mutationMeta('voice');
    const p = (action.payload || {}) as Record<string, unknown>;
    const targetName = String(p.name || '').trim();

    if (action.type === 'add_pantry') {
      const name = targetName || 'Ingredient';
      foodMemoryService.addPantryLot(meta, {
        productId: name.toLowerCase().replace(/\W/g, '-'),
        name,
        category: String(p.category || 'produce'),
        quantity: Number(p.quantity) || 1,
        reservedQuantity: 0,
        unit: 'each',
        storageLocation: 'refrigerator',
        freshnessStatus: 'fresh',
        freshnessConfidence: 0.9,
        freshnessEvidence: ['Voice confirmed']
      });
      setActiveOverlay('pantry');
      refreshMemory();
      return `Added ${name} to your pantry.`;
    }

    if (action.type === 'add_shopping') {
      const name = targetName || 'Produce item';
      foodMemoryService.addShoppingListItem(meta, {
        id: crypto.randomUUID(),
        name,
        reason: 'meal-plan',
        desiredQuantity: Number(p.quantity) || 1,
        availableQuantity: 0,
        missingQuantity: Number(p.quantity) || 1,
        unit: 'each',
        status: 'needed'
      });
      setActiveOverlay('shopping');
      refreshMemory();
      return `Added ${name} to your shopping list.`;
    }

    if (action.type === 'remove_pantry' || action.type === 'update_pantry') {
      // Read fresh from the store rather than a render-scoped const, which
      // this could otherwise close over and see a stale snapshot from an
      // earlier render.
      const freshLots = foodMemoryService.getState()?.pantryLots?.filter(l => l.remainingQuantity > 0) || [];
      const lot = freshLots.find(l => l.name.toLowerCase() === targetName.toLowerCase())
        || freshLots.find(l => l.name.toLowerCase().includes(targetName.toLowerCase()));
      if (lot && targetName) {
        const qty = Number(p.quantity) || lot.remainingQuantity;
        foodMemoryService.consumePantryLot(meta, lot.id, qty);
        setActiveOverlay('pantry');
        refreshMemory();
        return `Removed ${lot.name} from your pantry.`;
      }
      return `I couldn't find ${targetName || 'that item'} in your pantry to remove.`;
    }

    if (action.type === 'remove_shopping') {
      const freshList = foodMemoryService.getState()?.shoppingList?.filter(i => i.status !== 'purchased') || [];
      const item = freshList.find(i => i.name.toLowerCase() === targetName.toLowerCase())
        || freshList.find(i => i.name.toLowerCase().includes(targetName.toLowerCase()));
      if (item && targetName) {
        foodMemoryService.markShoppingItemPurchased(meta, item.id);
        setActiveOverlay('shopping');
        refreshMemory();
        return `Marked ${item.name} as bought.`;
      }
      return `I couldn't find ${targetName || 'that item'} on your shopping list.`;
    }

    if (action.type === 'update_habit') {
      const parts: string[] = [];
      const newAllergies = Array.isArray(p.allergies) ? (p.allergies as unknown[]).map(String).filter(Boolean) : [];
      if (newAllergies.length > 0) {
        foodMemoryService.addAllergies(meta, newAllergies);
        parts.push(`noted the allergy to ${newAllergies.join(', ')}`);
      }

      const habitPatch: Record<string, unknown> = {};
      const currentHabits = foodMemoryService.getState()?.familyHabits;
      const newRestrictions = Array.isArray(p.dietaryRestrictions) ? (p.dietaryRestrictions as unknown[]).map(String).filter(Boolean) : [];
      if (newRestrictions.length > 0) {
        const existing = currentHabits?.dietaryRestrictions || [];
        const existingLower = new Set(existing.map(r => r.toLowerCase()));
        habitPatch.dietaryRestrictions = [...existing, ...newRestrictions.filter(r => !existingLower.has(r.toLowerCase()))];
        parts.push(`updated your dietary restrictions to include ${newRestrictions.join(', ')}`);
      }
      const newGoals = Array.isArray(p.healthGoals) ? (p.healthGoals as unknown[]).map(String).filter(Boolean) : [];
      if (newGoals.length > 0) {
        const existing = currentHabits?.healthGoals || [];
        const existingLower = new Set(existing.map(g => g.toLowerCase()));
        habitPatch.healthGoals = [...existing, ...newGoals.filter(g => !existingLower.has(g.toLowerCase()))];
        parts.push(`added ${newGoals.join(', ')} to your health goals`);
      }
      if (typeof p.spiceTolerance === 'string' && p.spiceTolerance.trim()) {
        habitPatch.spiceTolerance = p.spiceTolerance.trim();
        parts.push(`set your spice tolerance to ${habitPatch.spiceTolerance}`);
      }
      if (typeof p.householdSize === 'number' && p.householdSize > 0) {
        habitPatch.householdSize = p.householdSize;
        parts.push(`updated your household size to ${p.householdSize}`);
      }
      if (Object.keys(habitPatch).length > 0) {
        foodMemoryService.updateHabits(meta, habitPatch as Partial<typeof currentHabits>);
      }

      if (parts.length === 0) {
        return "I didn't catch a specific preference to save there - could you say it again?";
      }
      refreshMemory();
      return `Got it, I've ${parts.join(' and ')}.`;
    }

    return "I don't yet support completing that action automatically - tell me what you'd like changed and I'll help another way.";
  };

  // Applies one agent response to app state - shared by user-triggered turns
  // and silent proactive check-ins. `userTurnText` is the text to log as the
  // user's side of the exchange, or null for a proactive check-in that has
  // no matching user utterance (only logged if the agent actually replied).
  const applyAgentResult = useCallback((result: AgentResult, userTurnText: string | null) => {
    const foreground = result.foreground || result.pullScreen;

    // Autonomous Camera Management & Screen Routing (agent-owned foreground)
    if (result.cameraCommand === 'open' || foreground === 'camera') {
      setShowCameraModal(true);
    } else if (result.cameraCommand === 'close') {
      setShowCameraModal(false);
    }

    if (foreground === 'pantry') {
      setActiveOverlay('pantry');
    } else if (foreground === 'shopping') {
      setActiveOverlay('shopping');
    } else if (foreground === 'cook') {
      setActiveOverlay('cook');
    } else if (foreground === 'close' || foreground === 'voice') {
      setActiveOverlay(null);
      setShowCameraModal(false);
    }

    // Autonomous Cooking Timer Trigger
    if (result.timer && typeof result.timer.durationSeconds === 'number') {
      setTimerSeconds(result.timer.durationSeconds);
      setTimerActive(true);
      setActiveOverlay('cook');
    }

    // Continuous Feedback Prompt & Adaptive Suggestions
    setFeedbackPrompt(result.feedbackPrompt || null);
    setAgentSuggestions(Array.isArray(result.suggestions) && result.suggestions.length > 0 ? result.suggestions : []);
    setWorkspaceResult(result.workspace && result.workspace.body ? result.workspace : null);

    if (result.produceAnalysis) {
      setProduceCard(result.produceAnalysis);
    }

    // Autonomous Item Auto-Tabulation when items are recognized
    if (Array.isArray((result as any).autoTabulatedItems) && (result as any).autoTabulatedItems.length > 0) {
      for (const item of (result as any).autoTabulatedItems) {
        if (!item.name) continue;
        // Each item needs its own idempotency key - mutationMeta('voice')
        // mints a fresh crypto.randomUUID() per call. Reusing a single meta
        // across this loop previously made every item after the first look
        // like a duplicate of the same mutation and get silently dropped.
        const meta = mutationMeta('voice');
        if (item.target === 'shopping') {
          foodMemoryService.addShoppingListItem(meta, {
            id: crypto.randomUUID(),
            name: item.name,
            reason: 'restock',
            desiredQuantity: Number(item.quantity) || 1,
            availableQuantity: 0,
            missingQuantity: Number(item.quantity) || 1,
            unit: item.unit || 'each',
            status: 'needed'
          });
        } else {
          foodMemoryService.addPantryLot(meta, {
            productId: item.name.toLowerCase().replace(/\W/g, '-'),
            name: item.name,
            category: item.category || 'produce',
            quantity: Number(item.quantity) || 1,
            reservedQuantity: 0,
            unit: item.unit || 'each',
            storageLocation: item.storageLocation || 'refrigerator',
            freshnessStatus: item.freshnessStatus || 'fresh',
            freshnessConfidence: 0.9,
            freshnessEvidence: ['Autonomous voice agent tabulation']
          });
        }
      }
      refreshMemory();
    }

    rememberNote(result.memoryNote);

    const hasSpeech = Boolean(result.speech && result.speech.trim());
    if (userTurnText !== null || hasSpeech) {
      setConversation(turns => {
        const next = [...turns];
        if (userTurnText !== null) {
          next.push({ id: crypto.randomUUID(), role: 'user', text: userTurnText, timestamp: new Date().toLocaleTimeString() });
        }
        if (hasSpeech) {
          next.push({ id: crypto.randomUUID(), role: 'assistant', text: result.speech, timestamp: new Date().toLocaleTimeString() });
        }
        return next.slice(-24);
      });
    }

    if (result.action) {
      if (result.confirmationRequired) {
        setPendingAction(result.action);
      } else if (result.action.type !== 'add_pantry' && result.action.type !== 'add_shopping') {
        // The model chose to act decisively rather than ask first (its
        // own call, per the master prompt's "supportive actions... act
        // decisively" guidance) and its speech above already narrates the
        // change as done - so this must actually happen, or that
        // narration becomes a false claim. add_pantry/add_shopping are
        // excluded here because the model reliably signals a confident,
        // no-confirmation add via autoTabulatedItems (handled above) -
        // found live that the model sometimes sets BOTH for the same
        // single add, and applying action too would double-add the item.
        executeAgentAction(result.action);
      }
    }

    if (result.returnToVoiceAfter) {
      scheduleReturnToVoice(result.returnToVoiceAfter);
    }

    if (hasSpeech) {
      speak(result.speech, result.audioData);
    }
    // A proactive check-in with nothing to say (hasSpeech false, userTurnText
    // null) intentionally does nothing further - no state disruption, no
    // interruption of whatever the user is doing.
  }, [speak, scheduleReturnToVoice, rememberNote]);

  // Main turn processing
  const handleTurn = useCallback(async (
    text: string,
    customImage: { mimeType: string; data: string } | null = null,
    options: { inputMode?: 'voice' | 'text' | 'click' } = {}
  ) => {
    const clean = text.trim();
    if (!clean && !customImage) return;
    // Guard against overlapping turns: continuous listening can emit another
    // final result while a previous request is still in flight, which used
    // to fire a second concurrent handleTurn and let whichever response
    // landed last silently clobber the other (garbled replies, cut audio).
    if (isProcessingRef.current) return;

    const inputMode = options.inputMode || 'voice';

    isProcessingRef.current = true;
    if (returnToVoiceTimerRef.current) clearTimeout(returnToVoiceTimerRef.current);
    speechSynthesizer.unlockAudio();

    if (customImage) {
      setTranscript(clean || 'Inspecting image...');
    } else {
      setTranscript(clean);
    }

    setVoiceState('understanding');

    telemetryService.logEvent('agent_turn', {
      userId: account?.uid || 'guest',
      userEmail: account?.email || 'guest',
      language,
      details: { prompt: clean, hasImage: Boolean(customImage), inputMode }
    });

    const lower = clean.toLowerCase();

    // 1. Explicit Voice Session End / Exit commands
    if (/^(end session|finish cooking|exit session|end conversation|finish session|done cooking|bye benkut|end cooking session)$/i.test(lower)) {
      if (isGuest && conversation.length > 0) {
        setShowSaveModal(true);
        speak('Would you like to save your cooking session and pantry updates before exiting?');
        isProcessingRef.current = false;
        return;
      } else {
        speak('Session complete. Have a wonderful meal!');
        isProcessingRef.current = false;
        return;
      }
    }

    // 2. Voice Stop / Standby commands
    if (/^(stop listening|pause voice|pause|be quiet|mute|goodbye|bye|go to sleep|exit voice|रुकें|వినడం ఆపండి|detener|arrêter)$/i.test(lower)) {
      isContinuousModeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (autoSleepTimerRef.current) clearTimeout(autoSleepTimerRef.current);
      try { recognition.current?.stop(); } catch { /* ignore */ }
      setVoiceState('ready');
      isProcessingRef.current = false;
      speak('Going on standby. Tap the microphone whenever you need me.');
      return;
    }

    // 3. Voice & Text Close / Camera Off / Dismiss commands
    if (/^(close|close camera|turn off camera|camera off|stop camera|close overlay|close screen|back|go back|exit|dismiss|hide overlay|बंद करें|कैमरा बंद करें|మూసివేయి|కెమెరా ఆపండి|cerrar|apagar cámara|fermer|éteindre caméra)$/i.test(lower)) {
      if (showCameraModal) {
        setShowCameraModal(false);
        speak('Camera is turned off.');
      } else if (activeOverlay) {
        setActiveOverlay(null);
        speak('Overlay closed.');
      } else {
        speak('Nothing to close.');
      }
      isProcessingRef.current = false;
      return;
    }

    // 4. Voice & Text Turn on Camera / Snap photo
    if (/^(turn on camera|open camera|start camera|camera on|camera|take a photo|take photo|take a snap|take snap|snap photo|snap a picture|click photo|photo|scan|picture|inspect produce|check produce|scan shelf|scan fridge|check apple|check fruit|check vegetables|कैमरा चालू करें|फोटो लें|కెమెరా తెరవండి|ఫోటో తీయండి|abrir cámara|tomar foto|ouvrir caméra|prendre photo)$/i.test(lower)) {
      setShowCameraModal(true);
      isProcessingRef.current = false;
      speak('Camera is turned on. Point at your food or kitchen shelf and say "snap" or tap Capture.');
      return;
    }

    // 5. Voice Scan Again / Redo command
    if (/^(redo scan|scan again|retake photo|take another photo|re-scan|re scan|दूसरा फोटो लें|మళ్ళీ స్కాన్ చేయండి)$/i.test(lower)) {
      setProduceCard(null);
      setShowCameraModal(true);
      isProcessingRef.current = false;
      speak('Opening camera to scan again.');
      return;
    }

    // 5. Pending Action Confirmations (or voice confirmation for produce add)
    if (pendingAction && /^(yes|confirm|do it|save|yeah|yep|sure|ok|okay|sí|si|हाँ|हां|haan|ha|అవును|add to pantry)$/i.test(clean)) {
      const replyText = executeAgentAction(pendingAction);
      setPendingAction(null);
      setConversation(turns => [
        ...turns,
        { id: crypto.randomUUID(), role: 'user', text: clean, timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), role: 'assistant', text: replyText, timestamp: new Date().toLocaleTimeString() }
      ]);
      isProcessingRef.current = false;
      speak(replyText);
      return;
    }

    if (pendingAction && /^(no|cancel|stop|nope|nah|don't|nahi|नहीं|వద్దు|no|non)$/i.test(clean)) {
      setPendingAction(null);
      isProcessingRef.current = false;
      speak('Cancelled. No changes made.');
      return;
    }

    // 5. Natural Voice Environment & Location Switching
    if (/^(i am at the supermarket|i am in the supermarket|at the grocery store|in grocery store|supermarket mode|grocery store mode|supermarket|tienda|mercado|supermarché)$/i.test(lower)) {
      handleSelectEnvironment('supermarket');
      isProcessingRef.current = false;
      return;
    }
    if (/^(i am in the pantry|in my pantry|check pantry shelves|pantry mode|in the kitchen pantry|at the fridge|despensa|garde manger)$/i.test(lower)) {
      handleSelectEnvironment('pantry');
      isProcessingRef.current = false;
      return;
    }
    if (/^(i am at the farmers market|at farm market|produce market|farm produce stand|farmers market mode|mercado de agricultores|marché fermier)$/i.test(lower)) {
      handleSelectEnvironment('farm_market');
      isProcessingRef.current = false;
      return;
    }
    if (/^(i am cooking|at the countertop|countertop mode|cooking mode|on the kitchen counter|encimera|plan de travail)$/i.test(lower)) {
      handleSelectEnvironment('countertop');
      isProcessingRef.current = false;
      return;
    }

    // 6. Quick Camera Triggers
    if (/^(open camera|camera|take a photo|photo|scan|picture|inspect produce|check produce|scan shelf|scan fridge|check apple|check fruit|check vegetables)$/i.test(lower)) {
      setShowCameraModal(true);
      isProcessingRef.current = false;
      speak('Camera is open. Point at food or your shelves and tap Snap.');
      return;
    }

    // 7. Direct Local Overlays Triggers
    if (/^(show pantry|open pantry|kitchen inventory|what's in my fridge|check pantry|what ingredients do i have|pantry)$/i.test(lower)) {
      setActiveOverlay('pantry');
      isProcessingRef.current = false;
      speak('Here is your pantry and fridge inventory.');
      return;
    }

    if (/^(open shopping|shopping list|grocery list|show groceries|buy groceries|shopping)$/i.test(lower)) {
      setActiveOverlay('shopping');
      isProcessingRef.current = false;
      speak('Here is your grocery shopping list.');
      return;
    }

    // 8. AI Processing with Gemini backend
    try {
      const memoryState = foodMemoryService.getState();
      const historyPayload = conversation.slice(-12).map(c => ({ role: c.role, text: c.text }));

      const response = await fetch('/api/agent/respond', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: clean,
          trigger: 'user',
          history: historyPayload,
          historySummary: (memoryState.memoryNotes || []).join(' | '),
          context: memoryState,
          environment,
          language,
          bcp47: langInfo.bcp47,
          voiceGender,
          image: customImage
        })
      });

      const rawText = await response.text();
      let result: AgentResult & { error?: string };
      try {
        result = JSON.parse(rawText);
      } catch {
        throw new Error(response.ok ? 'Agent returned an invalid response format' : `Server connection error (${response.status})`);
      }
      if (!response.ok) throw new Error(result.error || 'Agent service is temporarily unavailable');

      applyAgentResult(result, clean);
    } catch (err: unknown) {
      console.error('Agent turn failed:', err);
      const errMessage = err instanceof Error ? err.message : 'Could not process request';
      setSpokenReply(errMessage);
      speak(errMessage);
    } finally {
      isProcessingRef.current = false;
    }
  }, [account, conversation, language, langInfo.bcp47, pendingAction, activeOverlay, showCameraModal, speak, isGuest, applyAgentResult, environment, voiceGender]);

  // Proactive check-in: periodically (and when the tab regains focus) gives
  // the agent a silent turn - current kitchen state plus recent history,
  // no new user input - so it can speak up on its own when something is
  // genuinely worth surfacing (an expiring item, an unfinished shopping
  // list, a follow-up on something left open). Skips entirely whenever the
  // user is mid-interaction so it never talks over or interrupts anything.
  const runProactiveCheck = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (voiceState === 'speaking' || voiceState === 'listening' || voiceState === 'understanding') return;
    if (showCameraModal || showSettingsModal || showProfileModal || showAuthModal || showSaveModal || showTourModal) return;
    if (pendingAction) return;
    if (!account || isGuest) return;
    if (conversation.length === 0) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    isProcessingRef.current = true;
    try {
      const memoryState = foodMemoryService.getState();
      const historyPayload = conversation.slice(-12).map(c => ({ role: c.role, text: c.text }));

      const response = await fetch('/api/agent/respond', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: '',
          trigger: 'proactive',
          history: historyPayload,
          historySummary: (memoryState.memoryNotes || []).join(' | '),
          context: memoryState,
          environment,
          language,
          bcp47: langInfo.bcp47,
          voiceGender
        })
      });
      if (!response.ok) return;
      const rawText = await response.text();
      let result: AgentResult;
      try {
        result = JSON.parse(rawText);
      } catch {
        return;
      }
      applyAgentResult(result, null);
    } catch (err) {
      console.warn('Proactive check-in skipped (non-fatal):', err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [voiceState, showCameraModal, showSettingsModal, showProfileModal, showAuthModal, showSaveModal, showTourModal, pendingAction, account, isGuest, conversation, environment, language, langInfo.bcp47, voiceGender, applyAgentResult]);

  useEffect(() => {
    const interval = setInterval(() => { void runProactiveCheck(); }, PROACTIVE_CHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void runProactiveCheck();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [runProactiveCheck]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => RecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceState('unavailable');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = langInfo.bcp47;

      rec.onresult = (e: SpeechRecognitionEventLike) => {
        if (!e.results || !e.results.length) return;
        const currentResult = e.results[e.results.length - 1];
        const spoken = currentResult?.[0]?.transcript || '';
        if (!spoken) return;

        setTranscript(spoken);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (currentResult.isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            void handleTurn(spoken);
          }, 600);
        } else {
          silenceTimerRef.current = setTimeout(() => {
            void handleTurn(spoken);
          }, 1400);
        }
      };

      rec.onerror = (err: SpeechRecognitionErrorLike) => {
        console.warn('Speech recognition error:', err.error);
        if (err.error === 'not-allowed') {
          setVoiceState('unavailable');
        } else {
          setVoiceState('ready');
        }
      };

      rec.onend = () => {
        if (isContinuousModeRef.current && !speechSynthesizer.getIsSpeaking() && !isProcessingRef.current) {
          try {
            rec.start();
          } catch {
            setVoiceState('ready');
          }
        } else {
          setVoiceState('ready');
        }
      };

      recognition.current = rec;
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      setVoiceState('unavailable');
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (autoSleepTimerRef.current) clearTimeout(autoSleepTimerRef.current);
      try {
        recognition.current?.stop();
      } catch {
        // ignore
      }
    };
  }, [langInfo.bcp47, handleTurn]);

  const toggleListening = () => {
    speechSynthesizer.unlockAudio();

    if (voiceState === 'listening') {
      isContinuousModeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (autoSleepTimerRef.current) clearTimeout(autoSleepTimerRef.current);
      try { recognition.current?.stop(); } catch { /* ignore */ }
      setVoiceState('ready');
    } else {
      if (voiceState === 'speaking') {
        speechSynthesizer.stop();
      }
      isContinuousModeRef.current = true;

      try {
        recognition.current?.start();
        setVoiceState('listening');
        resetAutoSleepTimer();
      } catch {
        setVoiceState('listening');
      }
    }
  };

  const handleTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const query = draft.trim();
    setDraft('');
    void handleTurn(query, null, { inputMode: 'text' });
  };

  const activePantryLots = foodMemoryService.getState()?.pantryLots?.filter(l => l.remainingQuantity > 0) || [];
  const activeShoppingList = foodMemoryService.getState()?.shoppingList?.filter(i => i.status !== 'purchased') || [];

  const isLiveListening = voiceState === 'listening';
  const isSpeaking = voiceState === 'speaking';
  const isThinking = voiceState === 'understanding';

  // Handle saving produce from visual inspection
  const handleSaveProduceToPantry = (name: string, quantity: number) => {
    foodMemoryService.addPantryLot(mutationMeta('voice'), {
      productId: name.toLowerCase().replace(/\W/g, '-'),
      name,
      category: 'produce',
      quantity,
      reservedQuantity: 0,
      unit: 'each',
      storageLocation: 'refrigerator',
      freshnessStatus: 'fresh',
      freshnessConfidence: (produceCard?.freshnessScore || 90) / 100,
      freshnessEvidence: ['Camera inspection insight']
    });
    refreshMemory();
    setProduceCard(null);
    speak(`Saved ${quantity} ${name} to your pantry.`);
  };

  if (!authResolved) {
    return (
      <div className="h-[100dvh] bg-[#F5F7F3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <span className="material-symbols-outlined text-4xl text-[#174F35]">restaurant</span>
          <p className="text-stone-500 font-medium text-xs">Initializing Benkut Kitchen Companion...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="h-[100dvh] bg-[#F5F7F3] flex flex-col items-center justify-center relative">
        <AuthModal
          isOpen={true}
          onClose={() => navigate('/')}
          onAuthenticated={(acc) => {
            setAccount(acc);
            foodMemoryService.syncWithCloud(acc.uid);
          }}
          title={t('signInSignUp')}
          subtitle={t('subhead')}
        />
      </div>
    );
  }

  return (
    <main id="voice-agent-shell-root" className="h-[100dvh] max-h-[100dvh] bg-[#F5F7F3] text-[#17231C] font-sans flex flex-col justify-between select-none relative overflow-hidden">
      
      {/* 1. Ultra-Clean, Collision-Free Fixed Header */}
      <header
        id="voice-shell-header"
        className="h-14 sm:h-16 px-3.5 sm:px-6 border-b border-[#DFE5DF] flex items-center justify-between bg-[#F5F7F3] z-30 shrink-0"
      >
        {/* Left Brand & Status */}
        <div className="flex items-center gap-2.5">
          <button
            id="voice-header-back-button"
            onClick={handleExitAttempt}
            className="w-9 h-9 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-[#DFE5DF] flex items-center justify-center text-stone-700 hover:bg-stone-100 transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
            aria-label={t('backToHome') || 'Home'}
            title={t('backToHome') || 'Home'}
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-base sm:text-lg tracking-tight text-[#17231C] block leading-none">
              Benkut
            </span>

            {/* Live Indicator Pill */}
            <div
              id="voice-header-live-pill"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border transition ${
                isLiveListening
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : isSpeaking
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : isThinking
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-white text-stone-600 border-stone-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLiveListening ? 'bg-emerald-600 animate-ping' : isSpeaking ? 'bg-amber-600 animate-pulse' : isThinking ? 'bg-emerald-600 animate-pulse' : 'bg-[#174F35]'}`} />
              <span className="truncate max-w-[140px] sm:max-w-none" title={stateLabels[voiceState].label}>{stateLabels[voiceState].label}</span>
            </div>
          </div>
        </div>

        {/* Right Consolidated Controls */}
        <div className="flex items-center gap-1.5">
          
          {/* User Profile & GDPR Privacy */}
          <button
            id="voice-header-profile-btn"
            onClick={() => setShowProfileModal(true)}
            className="w-9 h-9 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-[#DFE5DF] flex items-center justify-center text-stone-700 hover:text-[#174F35] hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Profile, Preferences & GDPR Privacy"
            aria-label="Profile, Preferences & GDPR Privacy"
          >
            <span className="material-symbols-outlined text-lg">account_circle</span>
          </button>

          {/* Voice Sound Toggle */}
          <button
            id="voice-header-mute-btn"
            onClick={toggleMute}
            className="w-9 h-9 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-[#DFE5DF] flex items-center justify-center text-stone-700 hover:text-[#174F35] hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title={isMuted ? 'Unmute Voice' : 'Mute Voice'}
            aria-label="Toggle Voice Mute"
          >
            <span className="material-symbols-outlined text-lg">
              {isMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          {/* Unified Settings Menu */}
          <button
            id="voice-header-settings-btn"
            onClick={() => setShowSettingsModal(true)}
            className="w-9 h-9 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-[#DFE5DF] flex items-center justify-center text-stone-700 hover:text-[#174F35] hover:bg-stone-50 transition shadow-2xs cursor-pointer"
            title="Kitchen & Language Settings"
            aria-label="Kitchen & Language Settings"
          >
            <span className="material-symbols-outlined text-lg">tune</span>
          </button>
        </div>
      </header>

      {/* 2. Main Scrollable Conversation & Cockpit Area */}
      <section
        id="voice-main-cockpit"
        className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 pt-3 pb-24 text-center overscroll-contain flex flex-col items-center"
      >

        {/* Voice control stays pinned to the top of this scrollable area
            (sticky, not part of the normal flow) so a tall overlay or
            response card below can never scroll it out of view - the user
            must always be able to see and reach the agent's mic. */}
        <div id="voice-control-sticky-header" className="sticky top-0 z-20 w-full bg-[#F5F7F3] pb-1">
        {/* Interactive Environmental & Location Context Bar */}
        <div id="environmental-context-bar" className="relative w-full max-w-lg mx-auto mb-2 flex items-center justify-center">
          <button
            id="environmental-context-toggle-btn"
            onClick={() => setShowEnvSelector(!showEnvSelector)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#DFE5DF] text-stone-800 hover:border-[#174F35] transition shadow-2xs hover:bg-stone-50 cursor-pointer text-xs font-bold"
            title="Switch Location Context (Countertop, Pantry, Supermarket, Farm Market)"
            aria-label="Switch Location Context"
          >
            <span className="material-symbols-outlined text-[#174F35] text-base">
              {CULINARY_ENVIRONMENTS[environment]?.icon || 'countertops'}
            </span>
            <span className="truncate max-w-[160px] sm:max-w-none">
              {CULINARY_ENVIRONMENTS[environment]?.translations[language]?.label || 'Kitchen Countertop'}
            </span>
            <span className="material-symbols-outlined text-stone-400 text-sm">
              {showEnvSelector ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Environmental Context Dropdown Menu */}
          {showEnvSelector && (
            <div
              id="environmental-selector-dropdown"
              className="absolute top-10 z-40 w-72 sm:w-80 bg-white border border-[#DFE5DF] rounded-2xl p-2 shadow-xl animate-fade-in space-y-1 text-left"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Culinary Location Context
              </div>
              {(Object.keys(CULINARY_ENVIRONMENTS) as CulinaryEnvironment[]).map((envKey) => {
                const item = CULINARY_ENVIRONMENTS[envKey];
                const trans = item.translations[language] || item.translations.English;
                const isSelected = environment === envKey;
                return (
                  <button
                    key={envKey}
                    id={`env-select-option-${envKey}`}
                    onClick={() => handleSelectEnvironment(envKey)}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                      isSelected ? 'bg-[#E8F1E9] text-[#174F35] font-bold border border-[#174F35]/20' : 'hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${isSelected ? 'text-[#174F35]' : 'text-stone-500'}`}>
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs leading-tight flex items-center justify-between">
                        <span className="font-bold">{trans.label}</span>
                        {isSelected && <span className="text-[9px] font-extrabold text-[#174F35] bg-emerald-100 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                      </div>
                      <p className="text-[10px] text-stone-500 font-normal leading-tight mt-0.5">{trans.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Animated Central Voice Orb */}
        <div className="relative my-2 flex items-center justify-center shrink-0">
          <div
            className={`absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border transition-all duration-700 pointer-events-none ${
              isLiveListening
                ? 'border-[#174F35]/40 scale-125 animate-ping opacity-75'
                : isSpeaking
                ? 'border-amber-400/50 scale-115 animate-pulse'
                : isThinking
                ? 'border-emerald-500/50 animate-spin scale-110'
                : 'border-stone-300/40 scale-100 opacity-40'
            }`}
          />

          <div
            className={`absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full transition-all duration-500 pointer-events-none ${
              isLiveListening
                ? 'bg-emerald-500/20 blur-xl scale-110'
                : isSpeaking
                ? 'bg-amber-400/25 blur-xl scale-105'
                : 'bg-[#174F35]/10 blur-lg'
            }`}
          />

          <button
            id="voice-mic-main-orb"
            onClick={toggleListening}
            className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer ${
              isLiveListening
                ? 'bg-[#174F35] text-[#DFF36C] ring-4 ring-[#DFF36C] ring-offset-4 scale-105'
                : isSpeaking
                ? 'bg-amber-600 text-white ring-4 ring-amber-300 ring-offset-2'
                : isThinking
                ? 'bg-emerald-700 text-white animate-pulse'
                : 'bg-[#174F35] text-white hover:bg-[#0E3826] hover:scale-102'
            }`}
            aria-label={isLiveListening ? t('stopListening') || 'Stop' : t('tapToSpeak') || 'Speak'}
          >
            <span className="material-symbols-outlined text-3xl mb-0.5">
              {isSpeaking ? 'volume_up' : isThinking ? 'psychology' : isLiveListening ? 'graphic_eq' : 'mic'}
            </span>
            {/* Short, single-word forms only - the small circle has no
                room for the longer status sentences shown in the header
                pill below without overflowing or clipping mid-word. */}
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-1 text-center leading-tight">
              {isLiveListening ? (t('orbListening') || 'Listening') : isSpeaking ? (t('orbSpeaking') || 'Speaking') : isThinking ? (t('orbThinking') || 'Thinking') : (t('orbTapToSpeak') || 'Speak')}
            </span>
          </button>
        </div>

        {/* Live User Transcript */}
        <div id="voice-user-transcript-container" className="min-h-[28px] max-w-lg w-full flex items-center justify-center px-4 my-1">
          {transcript ? (
            <p id="voice-live-transcript-text" className="font-display font-bold text-sm sm:text-base text-stone-800 tracking-tight leading-snug animate-fade-in">
              “{transcript}”
            </p>
          ) : (
            <p className="text-[11px] text-stone-400 font-medium">
              Tap the green orb to speak hands-free or type below
            </p>
          )}
        </div>
        </div>

        {/* Scrollback Chat Log - every turn except the current exchange,
            which stays highlighted below in the main reply card. */}
        {conversation.length > 2 && (
          <div id="voice-chat-log" className="w-full max-w-lg space-y-1.5 mb-1">
            {conversation.slice(0, -2).map(turn => (
              <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed text-left ${
                    turn.role === 'user'
                      ? 'bg-[#174F35] text-white rounded-br-sm'
                      : 'bg-white border border-[#DFE5DF] text-stone-700 rounded-bl-sm'
                  }`}
                >
                  {turn.role === 'assistant' ? sanitizeSpokenText(turn.text) : turn.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Spoken Response & Main Insight Card */}
        <div
          id="voice-spoken-reply-card"
          className="w-full max-w-lg bg-white rounded-3xl p-4 sm:p-5 shadow-lg border border-[#DFE5DF] text-left transition-all space-y-3 mt-2"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[#E8F1E9] text-[#174F35] flex items-center justify-center font-bold text-xs">
                <span className="material-symbols-outlined text-xs">restaurant</span>
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#174F35]">
                {t('kitchenAssistant') || 'Kitchen Companion'}
              </span>
            </div>
            {spokenReply && (
              <button
                id="voice-replay-btn"
                onClick={() => speak(spokenReply)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-500 hover:text-[#174F35] cursor-pointer"
                title={t('replay') || 'Replay'}
              >
                <span className="material-symbols-outlined text-sm">volume_up</span>
                <span>{t('replay') || 'Replay'}</span>
              </button>
            )}
          </div>

          {/* Conversational Text - sanitized so any markdown the model
              slips into "speech" despite instructions never leaks through
              as literal asterisks/hashes (the TTS path already did this,
              the on-screen text didn't). */}
          <p id="voice-spoken-reply-body" className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line">
            {sanitizeSpokenText(spokenReply)}
          </p>

          {/* Contextual Visual Produce Insight Card with Edit & Redo */}
          {produceCard && (
            <div id="voice-produce-insight-card" className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-2.5 animate-fade-in text-xs text-stone-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-black text-sm text-emerald-950 flex items-center gap-1.5 min-w-0 break-words">
                  <span className="material-symbols-outlined text-emerald-700 text-base shrink-0">eco</span>
                  {produceCard.name}
                </span>
                <span className="rounded-full bg-[#174F35] px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-2xs shrink-0">
                  {produceCard.freshnessScore}% Fresh · {produceCard.ripeness.toUpperCase()}
                </span>
              </div>

              {produceCard.storageTip && (
                <p className="text-[11px] text-stone-700 leading-normal">
                  <strong>Storage:</strong> {produceCard.storageTip}
                </p>
              )}

              {produceCard.culinaryUse && (
                <p className="text-[11px] text-stone-600 leading-normal">
                  <strong>Best for:</strong> {produceCard.culinaryUse}
                </p>
              )}

              {produceCard.wastePreventionTip && (
                <div className="flex items-start gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200/60 text-[11px] text-amber-900 leading-tight">
                  <span className="material-symbols-outlined text-sm text-amber-700 shrink-0">recycling</span>
                  <span><strong>Zero-Waste Tip:</strong> {produceCard.wastePreventionTip}</span>
                </div>
              )}

              {/* Correcting the name/quantity used to mean tapping "Edit"
                  to retype it into a form - the same manual-entry pattern
                  as the removed pantry quick-add field. To correct what
                  the camera detected, just say the correction ("actually
                  it's 3 avocados") and the agent updates it. */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  id="produce-confirm-add-btn"
                  type="button"
                  onClick={() => handleSaveProduceToPantry(produceCard.name, 1)}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#174F35] text-white text-xs font-bold hover:bg-[#0E3826] transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_task</span>
                  <span>Add to Pantry</span>
                </button>

                <button
                  id="produce-rescan-btn"
                  type="button"
                  onClick={() => {
                    setProduceCard(null);
                    setShowCameraModal(true);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-100 transition flex items-center gap-1 cursor-pointer"
                  title="Redo photo scan"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>Redo</span>
                </button>
              </div>
            </div>
          )}

          {/* Structured Workspace Card formatted cleanly in Markdown without raw dumps */}
          {workspaceResult && (
            <div id="voice-workspace-result-card" className="rounded-2xl border border-stone-200 bg-stone-50/90 p-4 space-y-2 animate-fade-in text-xs text-stone-800 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#174F35] shrink-0"></span>
                <h4 className="font-bold text-stone-900 text-xs tracking-tight break-words min-w-0">{workspaceResult.title}</h4>
              </div>
              <MarkdownRenderer content={workspaceResult.body} />
            </div>
          )}

          {/* Continuous Feedback Prompt & Adaptive Suggestion Chips */}
          {(feedbackPrompt || agentSuggestions.length > 0) && (
            <div id="voice-feedback-prompt-card" className="rounded-2xl border border-[#174F35]/20 bg-[#E8F1E9]/50 p-3 space-y-2 animate-fade-in">
              {feedbackPrompt && (
                <div className="flex items-center gap-2 text-xs font-bold text-[#174F35]">
                  <span className="material-symbols-outlined text-base">chat_bubble</span>
                  <span>{feedbackPrompt}</span>
                </div>
              )}
              {agentSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {agentSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      id={`voice-suggestion-chip-${idx}`}
                      type="button"
                      onClick={() => void handleTurn(sug)}
                      className="px-2.5 py-1 bg-white border border-[#174F35]/25 rounded-full text-[11px] font-semibold text-stone-700 hover:text-[#174F35] hover:border-[#174F35] hover:bg-[#E8F1E9] transition cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs text-[#174F35]">mic</span>
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Action Confirmation Banner */}
          {pendingAction && (
            <div id="voice-pending-action-banner" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2 animate-fade-in">
              <span className="text-xs font-bold text-amber-900 block">{pendingAction.label}</span>
              <div className="flex items-center gap-2">
                <button
                  id="voice-action-confirm-yes"
                  onClick={() => void handleTurn('yes')}
                  className="rounded-xl bg-[#174F35] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-[#0E3826] cursor-pointer"
                >
                  ✓ Yes (Say "Yes")
                </button>
                <button
                  id="voice-action-confirm-no"
                  onClick={() => void handleTurn('no')}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Dynamic Visual Overlays ONLY when user explicitly asks for them or modifies items */}
        {/* Pantry/Shopping overlays are read-only mirrors of the agent's
            own memory - every addition, removal, or "used"/"bought" mark
            happens by talking to the agent (voice or the command bar), so
            it can narrate what changed. A separate manual add-field and
            one-tap buttons here let the UI silently diverge from what the
            agent believes is true and gave the app two disconnected ways
            to edit the same data. */}
        {activeOverlay === 'pantry' && (
          <div id="overlay-pantry-container" className="w-full max-w-lg bg-white rounded-3xl p-4 shadow-lg border border-emerald-200 text-left animate-fade-in mt-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-base">kitchen</span>
                <h3 className="font-display font-bold text-xs text-stone-900">Pantry & Fridge Inventory</h3>
              </div>
              <button onClick={() => setActiveOverlay(null)} className="text-xs font-bold text-stone-400 hover:text-stone-700 cursor-pointer">
                Close ✕
              </button>
            </div>

            {activePantryLots.length === 0 ? (
              <p className="text-xs text-stone-500 py-2 text-center">Your pantry is clear. Tell Benkut what you bought or scan with camera.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {activePantryLots.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                    <span className="font-bold text-stone-900 block text-xs truncate">{item.name}</span>
                    <span className="text-[10px] text-stone-500 shrink-0 pl-1.5">{item.remainingQuantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-stone-400 text-center pt-1">Say or type what changed - "I used the onions", "add two eggs"...</p>
          </div>
        )}

        {activeOverlay === 'shopping' && (
          <div id="overlay-shopping-container" className="w-full max-w-lg bg-white rounded-3xl p-4 shadow-lg border border-orange-200 text-left animate-fade-in mt-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 text-base">shopping_basket</span>
                <h3 className="font-display font-bold text-xs text-stone-900">Grocery Shopping List</h3>
              </div>
              <button onClick={() => setActiveOverlay(null)} className="text-xs font-bold text-stone-400 hover:text-stone-700 cursor-pointer">
                Close ✕
              </button>
            </div>

            {activeShoppingList.length === 0 ? (
              <p className="text-xs text-stone-500 py-2 text-center">Shopping list is clear! Tell Benkut what ingredients you need.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {activeShoppingList.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                    <span className="font-bold text-stone-800 text-xs truncate">{item.name} ({item.missingQuantity || item.desiredQuantity} {item.unit})</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-stone-400 text-center pt-1">Say or type what changed - "I bought the tortillas", "add avocados"...</p>
          </div>
        )}

        {activeOverlay === 'cook' && (
          <div id="overlay-cook-container" className="w-full max-w-lg bg-white rounded-3xl p-4 shadow-lg border border-rose-200 text-left animate-fade-in mt-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-base">skillet</span>
                <h3 className="font-display font-bold text-xs text-stone-900">Cooking Timer & Coach</h3>
              </div>
              <button onClick={() => setActiveOverlay(null)} className="text-xs font-bold text-stone-400 hover:text-stone-700 cursor-pointer">
                Close ✕
              </button>
            </div>

            <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div>
                <span className="text-[10px] font-bold text-stone-500 block uppercase">Timer</span>
                <span className="font-mono text-xl font-black text-stone-900">
                  {timerSeconds !== null
                    ? `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}`
                    : '0:00'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setTimerSeconds(5 * 60);
                    setTimerActive(true);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  +5m
                </button>
                <button
                  onClick={() => {
                    setTimerSeconds(10 * 60);
                    setTimerActive(true);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  +10m
                </button>
                {timerActive ? (
                  <button
                    onClick={() => setTimerActive(false)}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Pause
                  </button>
                ) : timerSeconds && timerSeconds > 0 ? (
                  <button
                    onClick={() => setTimerActive(true)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Resume
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Quick-starter chips lived here as a second, hardcoded set of
            prompt buttons stacked directly under the Adaptive Suggestion
            Chips above - two suggestion rows doing the same job on first
            load. Removed: the environment-aware agentSuggestions chips
            (which already include a scan/camera option in most contexts)
            now cover this alone. */}

        <div ref={chatBottomRef} className="h-4 shrink-0" />
      </section>

      {/* 5. Minimalist Countertop Bottom Text Input Bar */}
      <footer
        id="voice-shell-bottom-bar"
        className="fixed bottom-0 left-0 right-0 z-20 bg-[#F5F7F3]/95 backdrop-blur-sm border-t border-[#DFE5DF] px-3.5 py-2.5 sm:px-6"
      >
        <div className="max-w-xl mx-auto flex items-center gap-2">
          
          {/* Quick Camera Scanner Button */}
          <button
            id="voice-bar-camera-btn"
            onClick={() => setShowCameraModal(true)}
            className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-2xl bg-white border border-[#DFE5DF] flex items-center justify-center text-stone-700 hover:text-[#174F35] hover:bg-stone-50 transition shadow-2xs cursor-pointer shrink-0 active:scale-95"
            title="Scan with Camera"
            aria-label="Scan with Camera"
          >
            <span className="material-symbols-outlined text-xl">photo_camera</span>
          </button>

          {/* Discreet Bottom Text Input Bar */}
          <form
            id="voice-multimodal-text-form"
            onSubmit={handleTextSubmit}
            className="flex-1 flex items-center gap-1.5 bg-white rounded-2xl px-3.5 py-1.5 border border-stone-300 shadow-2xs focus-within:border-[#174F35] focus-within:ring-2 focus-within:ring-[#174F35]/15 transition"
          >
            <input
              id="voice-multimodal-text-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Benkut or type query..."
              className="flex-1 text-xs sm:text-sm text-stone-900 bg-transparent border-none focus:outline-none py-1"
            />
            {draft.trim() && (
              <button
                id="voice-multimodal-send-btn"
                type="submit"
                className="h-8 px-3.5 rounded-xl bg-[#174F35] text-xs font-bold text-white hover:bg-[#0E3826] transition shadow-xs cursor-pointer shrink-0"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </footer>

      {/* Modals & Dialogs */}
      <KitchenSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        account={account}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenTour={() => setShowTourModal(true)}
        onClearSession={handleClearSession}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        voiceGender={voiceGender}
        onChangeVoiceGender={(g) => {
          setVoiceGender(g);
          speechSynthesizer.setVoiceGender(g);
        }}
        environment={environment}
        onChangeEnvironment={handleSelectEnvironment}
      />

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        account={account}
        onAccountChange={setAccount}
      />

      <CameraInspectionModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        environment={environment}
        onEnvironmentChange={handleSelectEnvironment}
        voiceCommand={transcript}
        history={conversation.slice(-12).map(c => ({ role: c.role, text: c.text }))}
        isListening={isLiveListening}
        onToggleListening={toggleListening}
        onAnalysisComplete={(data: any) => {
          // Note: autoTabulatedItems is already applied inside
          // CameraInspectionModal itself (executeAutonomousTabulation) -
          // don't route this through applyAgentResult or it would double-add.
          if (data.speech) speak(data.speech, data.audioData);
          if (data.produceAnalysis) {
            setProduceCard(data.produceAnalysis);
          }
          if (data.workspace) setWorkspaceResult(data.workspace);
          const foreground = data.foreground || data.pullScreen;
          if (foreground === 'pantry' || data.specialist === 'pantry') setActiveOverlay('pantry');
          if (foreground === 'shopping' || data.specialist === 'shopping') setActiveOverlay('shopping');
          if (foreground === 'close' || foreground === 'voice' || data.cameraCommand === 'close') {
            setShowCameraModal(false);
          }
          if (data.returnToVoiceAfter) scheduleReturnToVoice(data.returnToVoiceAfter);
          rememberNote(data.memoryNote);
          if (data.speech) {
            setConversation(turns => [
              ...turns,
              { id: crypto.randomUUID(), role: 'assistant' as const, text: data.speech, timestamp: new Date().toLocaleTimeString() }
            ].slice(-24));
          }
          refreshMemory();
        }}
      />

      <AppTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
      />

      <SaveSessionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSignInToSave={() => {
          setShowSaveModal(false);
          setShowAuthModal(true);
        }}
        onExitWithoutSaving={handleExitWithoutSaving}
        turnCount={conversation.length}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleSaveAfterAuth}
        title="Sign in to save your session"
        subtitle="Create an account or sign in with Google or Email to save your recipes, pantry updates, and family food preferences."
      />
    </main>
  );
};

export default VoiceAgentShell;
