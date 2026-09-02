import { getDb } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';

export type TelemetryEventType =
  | 'session_start'
  | 'agent_select'
  | 'agent_turn'
  | 'voice_turn'
  | 'text_turn'
  | 'camera_scan'
  | 'item_added'
  | 'language_change'
  | 'environment_switch'
  | 'meal_cooked'
  | 'meal_logged'
  | 'profile_update'
  | 'auth_success'
  | 'suggestion_click'
  | 'suggestion_clicked'
  | 'session_exit_guest_unsaved'
  | 'pwa_install_prompt_shown'
  | 'pwa_install_success';

export interface TelemetryEvent {
  id?: string;
  userId: string;
  userEmail?: string;
  eventType: TelemetryEventType;
  specialist?: string;
  language: string;
  details?: Record<string, any>;
  timestamp: string;
}

const LOCAL_STORAGE_KEY = 'benkut_telemetry_events';

class TelemetryService {
  private localEvents: TelemetryEvent[] = [];

  constructor() {
    this.loadLocalEvents();
  }

  private loadLocalEvents() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        this.localEvents = JSON.parse(data);
      }
    } catch {
      this.localEvents = [];
    }
  }

  private saveLocalEvents() {
    try {
      // Keep last 100 events locally
      const trimmed = this.localEvents.slice(-100);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  }

  public async logEvent(
    eventType: TelemetryEvent['eventType'],
    data: {
      userId?: string;
      userEmail?: string;
      specialist?: string;
      language?: string;
      details?: Record<string, any>;
    }
  ): Promise<void> {
    const userId = data.userId || localStorage.getItem('benkut_user_id') || 'anonymous_user';
    const userEmail = data.userEmail || localStorage.getItem('benkut_user_email') || 'guest@benkut.local';
    const language = data.language || localStorage.getItem('benkut_language') || 'English';

    const event: TelemetryEvent = {
      userId,
      userEmail,
      eventType,
      specialist: data.specialist || 'general',
      language,
      details: data.details || {},
      timestamp: new Date().toISOString()
    };

    // Store in local ring buffer
    this.localEvents.push(event);
    this.saveLocalEvents();

    // Store in Firestore if available
    try {
      const db = getDb();
      if (db) {
        await addDoc(collection(db, 'telemetry_events'), {
          ...event,
          serverTimestamp: serverTimestamp()
        });
      }
    } catch (e) {
      // Non-blocking telemetry
      console.debug('[Telemetry] Saved locally only:', e);
    }
  }

  public getLocalEvents(): TelemetryEvent[] {
    this.loadLocalEvents();
    return [...this.localEvents].reverse();
  }

  public async getRecentEvents(count = 50): Promise<TelemetryEvent[]> {
    try {
      const db = getDb();
      if (db) {
        const q = query(collection(db, 'telemetry_events'), orderBy('serverTimestamp', 'desc'), limit(count));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as TelemetryEvent));
        }
      }
    } catch (e) {
      console.debug('[Telemetry] Fetching from Firestore failed, fallback to local:', e);
    }
    return this.getLocalEvents().slice(0, count);
  }

  public getStats() {
    const events = this.getLocalEvents();
    const total = events.length;
    const voiceCount = events.filter(e => e.eventType === 'voice_turn').length;
    const textCount = events.filter(e => e.eventType === 'text_turn').length;
    const scanCount = events.filter(e => e.eventType === 'camera_scan').length;
    const guestEventsCount = events.filter(e => e.userId.startsWith('guest') || e.userEmail?.includes('guest')).length;
    const registeredEventsCount = total - guestEventsCount;

    const languages: Record<string, number> = {};
    const specialists: Record<string, number> = {};

    events.forEach(e => {
      languages[e.language] = (languages[e.language] || 0) + 1;
      if (e.specialist) {
        specialists[e.specialist] = (specialists[e.specialist] || 0) + 1;
      }
    });

    return {
      total,
      voiceCount,
      textCount,
      scanCount,
      guestEventsCount,
      registeredEventsCount,
      languages,
      specialists
    };
  }
}

export const telemetryService = new TelemetryService();
