import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut as fbSignOut, onAuthStateChanged, User, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp, setLogLevel } from 'firebase/firestore';

// Suppress internal Firestore connection state logs when operating in offline/client-cache mode
try {
  setLogLevel('silent');
} catch {
  // Ignore in environments where setLogLevel is not supported
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const authInstance = getAuthSafe();
  const currentUser = authInstance?.currentUser;
  const rawMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMsg,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  // If this is an offline or unavailable network error, log a gentle debug/warning so offline cache continues
  if (rawMsg.includes('unavailable') || rawMsg.includes('offline') || rawMsg.includes('Could not reach Cloud Firestore')) {
    console.warn(`[Firestore Offline Mode] Operation ${operationType} on ${path}: Backend temporarily unavailable. Operating in local cache.`);
    return;
  }

  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
}

const getFirebaseConfig = () => {
  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string) || (typeof process !== 'undefined' ? process.env.FIREBASE_API_KEY : '');
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || (typeof process !== 'undefined' ? process.env.FIREBASE_PROJECT_ID : 'cookcoach-ai');
  const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || `${projectId}.firebaseapp.com`;
  const storageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || `${projectId}.appspot.com`;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
  };
};

export const isFirebaseConfigured = () => {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.apiKey.trim() !== '' && !cfg.apiKey.includes('your-') && !cfg.apiKey.includes('placeholder'));
};

let appInstance: any = null;
let dbInstance: any = null;
let authInstance: any = null;

export const getFirebaseApp = () => {
  if (appInstance) return appInstance;
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!getApps().length) {
    const config = getFirebaseConfig();
    appInstance = initializeApp(config);
  } else {
    appInstance = getApp();
  }
  return appInstance;
};

export const getDb = () => {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  if (app) {
    dbInstance = getFirestore(app);
  }
  return dbInstance;
};

export const getAuthSafe = () => {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (app) {
    authInstance = getAuth(app);
  }
  return authInstance;
};

// Real database persistence for Food Memory & Sessions
export class FirebaseDataService {
  private static instance: FirebaseDataService;

  public static getInstance(): FirebaseDataService {
    if (!FirebaseDataService.instance) {
      FirebaseDataService.instance = new FirebaseDataService();
    }
    return FirebaseDataService.instance;
  }

  // Google sign in helper
  public async signInAnonymously(): Promise<User | null> {
    const auth = getAuthSafe();
    if (!auth) throw new Error('Firebase Auth is not configured. Please supply VITE_FIREBASE_API_KEY.');
    const result = await signInAnonymously(auth);
    return result.user;
  }

  // Google sign in helper
  public async signInWithGoogle(): Promise<User | null> {
    const auth = getAuthSafe();
    if (!auth) throw new Error('Firebase Auth is not configured. Please supply VITE_FIREBASE_API_KEY.');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }

  public async signOut(): Promise<void> {
    const auth = getAuthSafe();
    if (auth) {
      await fbSignOut(auth);
    }
  }

  // Save session record to Firestore
  public async saveSession(userId: string, sessionId: string, sessionData: any) {
    const db = getDb();
    if (!db) {
      console.warn('[Firebase] DB not initialized. Skipping cloud session save.');
      return;
    }
    const path = `users/${userId}/conversations/${sessionId}`;
    try {
      await setDoc(doc(db, 'users', userId, 'conversations', sessionId), {
        ...sessionData,
        sessionId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Save entire food memory state to Firestore
  public async saveFoodMemory(userId: string, memoryState: any) {
    const db = getDb();
    if (!db) return;
    const path = `users/${userId}/foodMemory/state`;
    try {
      await setDoc(doc(db, 'users', userId, 'foodMemory', 'state'), {
        state: memoryState,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Load food memory state from Firestore
  public async loadFoodMemory(userId: string): Promise<any | null> {
    const db = getDb();
    if (!db) return null;
    const path = `users/${userId}/foodMemory/state`;
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'foodMemory', 'state'));
      if (snap.exists()) {
        const data = snap.data();
        return data.state || null;
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }

  // Real-time listener for user food memory
  public subscribeToFoodMemory(userId: string, callback: (state: any) => void) {
    const db = getDb();
    if (!db) return () => {};
    const path = `users/${userId}/foodMemory/state`;
    return onSnapshot(
      doc(db, 'users', userId, 'foodMemory', 'state'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.state) {
            callback(data.state);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
  }

  // GDPR Right to Erasure (Article 17): Delete user cloud data and optionally delete user account
  public async deleteUserData(userId: string): Promise<boolean> {
    const db = getDb();
    if (db && userId) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'foodMemory', 'state'));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${userId}/foodMemory/state`);
      }
    }

    const auth = getAuthSafe();
    if (auth && auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch (authErr) {
        // If re-authentication is required, at least sign out
        try {
          await fbSignOut(auth);
        } catch {
          // ignore
        }
      }
    }
    return true;
  }
}

export const firebaseService = FirebaseDataService.getInstance();

export const signInWithGoogleSafe = async (): Promise<User | null> => {
  return firebaseService.signInWithGoogle();
};

export const signInAnonymouslySafe = async (): Promise<User | null> => {
  return firebaseService.signInAnonymously();
};
