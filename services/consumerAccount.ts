export type ConsumerAccount = {
  uid: string;
  email: string;
  idToken?: string;
  storageConsent?: boolean;
  authenticatedAt?: string;
};

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

const requireConfig = () => {
  if (!apiKey || !projectId) throw new Error('Account storage is not configured for this deployment.');
};

export const authenticateConsumer = async (mode: 'signin' | 'signup', email: string, password: string): Promise<ConsumerAccount> => {
  requireConfig();
  const method = mode === 'signup' ? 'signUp' : 'signInWithPassword';
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(apiKey!)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message?.replaceAll('_', ' ') || 'Authentication failed.');
  return { uid: result.localId, email: result.email, idToken: result.idToken };
};

type FirestoreValue = { stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; timestampValue?: string; nullValue?: null; arrayValue?: { values: FirestoreValue[] }; mapValue?: { fields: Record<string, FirestoreValue> } };
const encode = (value: unknown): FirestoreValue => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encode(item)])) } };
};

export const saveConversation = async (account: ConsumerAccount, session: Record<string, unknown>) => {
  requireConfig();
  const sessionId = String(session.sessionId);
  const fields = Object.fromEntries(Object.entries(session).map(([key, value]) => [key, encode(value)]));
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId!)}/databases/(default)/documents/users/${encodeURIComponent(account.uid)}/conversations/${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, { method: 'PATCH', headers: { authorization: `Bearer ${account.idToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'The conversation could not be saved.');
  return result;
};
