import { defaultFamilyHabits, emptyFoodMemory, FamilyHabits, FoodEvent, FoodMemoryState, FoodSource, MealLog, MutationMeta, PantryLot, ShoppingItem, useFirstLots, usableQuantity } from '../domain/foodMemory';
import { firebaseService, getAuthSafe } from './firebase';

const KEY = 'benkut-food-memory-v1';
const now = () => new Date().toISOString();

const load = (): FoodMemoryState => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : emptyFoodMemory();

    const pantryLots = Array.isArray(parsed?.pantryLots) ? parsed.pantryLots : [];
    const mealLogs = Array.isArray(parsed?.mealLogs) ? parsed.mealLogs : [];
    const shoppingItems: ShoppingItem[] = Array.isArray(parsed?.shoppingItems)
      ? parsed.shoppingItems
      : Array.isArray(parsed?.shoppingList)
      ? parsed.shoppingList
      : [];

    const familyHabits: FamilyHabits = (parsed?.familyHabits && typeof parsed.familyHabits === 'object' && Array.isArray(parsed.familyHabits.dietaryRestrictions))
      ? {
          dietaryRestrictions: Array.isArray(parsed.familyHabits.dietaryRestrictions) ? parsed.familyHabits.dietaryRestrictions : ['Vegetarian / Flexitarian'],
          favoriteMealIdeas: Array.isArray(parsed.familyHabits.favoriteMealIdeas) ? parsed.familyHabits.favoriteMealIdeas : ['Fresh Vegetable Stir-Fry', 'Lentil Soup'],
          spiceTolerance: parsed.familyHabits.spiceTolerance || 'Medium Spice',
          householdSize: parsed.familyHabits.householdSize || 2,
          healthGoals: Array.isArray(parsed.familyHabits.healthGoals) ? parsed.familyHabits.healthGoals : []
        }
      : defaultFamilyHabits();

    const events = Array.isArray(parsed?.events) ? parsed.events : [];
    const allergies = Array.isArray(parsed?.allergies) ? parsed.allergies : [];
    const preferences = (parsed?.preferences && typeof parsed.preferences === 'object')
      ? {
          confirmed: Array.isArray(parsed.preferences.confirmed) ? parsed.preferences.confirmed : [],
          hypotheses: Array.isArray(parsed.preferences.hypotheses) ? parsed.preferences.hypotheses : []
        }
      : { confirmed: [], hypotheses: [] };
    const memoryNotes = Array.isArray(parsed?.memoryNotes) ? parsed.memoryNotes : [];

    return {
      pantryLots,
      mealLogs,
      shoppingItems,
      shoppingList: shoppingItems,
      familyHabits,
      events,
      memoryNotes,
      allergies,
      preferences
    };
  } catch {
    return emptyFoodMemory();
  }
};

// Both failure paths below used to be a bare console.warn - invisible
// outside devtools, so the user had no way to know a change wasn't
// actually saved (localStorage failure) or wasn't backed up to their
// account yet (Firestore failure). Dispatch a real event so the UI can
// tell them plainly, in the agent's own voice, instead of silently
// carrying on as if everything succeeded.
export interface SyncIssueDetail { scope: 'local' | 'cloud'; message: string }
const reportSyncIssue = (detail: SyncIssueDetail) => {
  window.dispatchEvent(new CustomEvent<SyncIssueDetail>('benkut-sync-issue', { detail }));
};

const save = (state: FoodMemoryState) => {
  try {
    if (!state.shoppingList) state.shoppingList = state.shoppingItems;
    if (!state.shoppingItems) state.shoppingItems = state.shoppingList || [];
    if (!state.familyHabits) state.familyHabits = defaultFamilyHabits();
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
    reportSyncIssue({ scope: 'local', message: e instanceof Error ? e.message : String(e) });
  }
  window.dispatchEvent(new Event('benkut-memory'));

  // If user is authenticated in Firebase, automatically sync to Cloud Firestore
  try {
    const auth = getAuthSafe();
    const uid = auth?.currentUser?.uid;
    if (uid) {
      firebaseService.saveFoodMemory(uid, state).catch(err => {
        console.warn('Firestore cloud sync notice:', err);
        reportSyncIssue({ scope: 'cloud', message: err instanceof Error ? err.message : String(err) });
      });
    }
  } catch (e) {
    reportSyncIssue({ scope: 'cloud', message: e instanceof Error ? e.message : String(e) });
  }
};

const assertMeta = (m: MutationMeta) => {
  if (!m.actorUid || !m.householdId || !m.idempotencyKey || !m.source) {
    throw new Error('Authenticated actor, household, source and idempotency key are required');
  }
};

class FoodMemoryService {
  private activeCloudUnsub: (() => void) | null = null;

  constructor() {
    // Attempt cloud sync on auth change if available
    try {
      const auth = getAuthSafe();
      if (auth) {
        auth.onAuthStateChanged((user) => {
          if (user) {
            this.syncWithCloud(user.uid);
          } else if (this.activeCloudUnsub) {
            this.activeCloudUnsub();
            this.activeCloudUnsub = null;
          }
        });
      }
    } catch {
      // Ignore if auth not yet initialized
    }
  }

  // Synchronize local memory with Firestore cloud database
  async syncWithCloud(userId: string) {
    try {
      const remoteState = await firebaseService.loadFoodMemory(userId);
      if (remoteState && remoteState.events) {
        // Merge or adopt remote state
        localStorage.setItem(KEY, JSON.stringify(remoteState));
        window.dispatchEvent(new Event('benkut-memory'));
      } else {
        // Push local state to cloud
        const currentLocal = load();
        if (currentLocal.pantryLots.length > 0 || currentLocal.mealLogs.length > 0) {
          await firebaseService.saveFoodMemory(userId, currentLocal);
        }
      }

      // Start live snapshot listener
      if (this.activeCloudUnsub) this.activeCloudUnsub();
      this.activeCloudUnsub = firebaseService.subscribeToFoodMemory(userId, (cloudState) => {
        if (cloudState && cloudState.events) {
          localStorage.setItem(KEY, JSON.stringify(cloudState));
          window.dispatchEvent(new Event('benkut-memory'));
        }
      });
    } catch (e) {
      console.warn('Cloud sync error:', e);
    }
  }

  subscribe(fn: (s: FoodMemoryState) => void) {
    const listener = () => fn(load());
    window.addEventListener('benkut-memory', listener);
    fn(load());
    return () => window.removeEventListener('benkut-memory', listener);
  }

  getState() {
    return load();
  }

  private mutate<T>(meta: MutationMeta, eventType: string, work: (state: FoodMemoryState) => T): T {
    assertMeta(meta);
    const state = load();
    const prior = state.events.find(e => e.idempotencyKey === meta.idempotencyKey);
    if (prior) return prior.payload.result as T;
    const result = work(state);
    const event: FoodEvent = {
      eventId: crypto.randomUUID(),
      eventType,
      householdId: meta.householdId,
      actorUid: meta.actorUid,
      occurredAt: now(),
      createdAt: now(),
      source: meta.source,
      idempotencyKey: meta.idempotencyKey,
      confidence: 1,
      payload: { result: result as unknown },
      schemaVersion: 1
    };
    state.events.push(event);
    save(state);
    return result;
  }

  getUserFoodProfile() {
    const s = load();
    return { allergies: s.allergies, preferences: s.preferences };
  }

  // Long-term memory notes (durable facts the agent chose to remember) -
  // stored as part of the same unified state as everything else here, so
  // they get the same Firestore sync/offline/cross-device behavior for
  // free instead of a separate ad-hoc localStorage path.
  getMemoryNotes(): string[] {
    return load().memoryNotes || [];
  }

  addMemoryNote(note: string) {
    if (!note) return;
    const state = load();
    const existing = state.memoryNotes || [];
    if (existing.includes(note)) return;
    state.memoryNotes = [...existing, note].slice(-12);
    save(state);
  }

  getHouseholdContext() {
    const auth = getAuthSafe();
    const uid = auth?.currentUser?.uid || 'demo-user';
    return { householdId: 'household-' + uid, members: [uid], state: load() };
  }

  getRelevantFoodMemory(scope: 'fresh' | 'chef' | 'eating') {
    const s = load();
    return scope === 'fresh'
      ? { pantry: s.pantryLots, shopping: s.shoppingItems, allergies: s.allergies }
      : scope === 'chef'
      ? { pantry: useFirstLots(s.pantryLots), allergies: s.allergies, recentMeals: s.mealLogs.slice(-5) }
      : { recentMeals: s.mealLogs.slice(-10), hypotheses: s.preferences.hypotheses };
  }

  listPantryItems() {
    return load().pantryLots;
  }

  getPantryAvailability(name: string) {
    const s = load();
    return {
      name,
      usableQuantity: usableQuantity(s.pantryLots, name),
      lots: useFirstLots(s.pantryLots).filter(l => l.name.toLowerCase() === name.toLowerCase())
    };
  }

  getUseFirstItems() {
    return useFirstLots(load().pantryLots).filter(l => l.freshnessStatus === 'use-first' || l.freshnessStatus === 'use-soon').slice(0, 8);
  }

  getFreshnessAlerts() {
    return load().pantryLots.filter(l => ['use-soon', 'use-first', 'possibly-deteriorating', 'expired'].includes(l.freshnessStatus));
  }

  addPantryLot(meta: MutationMeta, input: Omit<PantryLot, 'id' | 'createdAt' | 'updatedAt' | 'originalQuantity' | 'remainingQuantity' | 'lotStatus'>) {
    return this.mutate(meta, 'PANTRY_LOT_ADDED', s => {
      if (input.quantity <= 0) throw Error('Quantity must be positive');
      const lot: PantryLot = {
        ...input,
        id: crypto.randomUUID(),
        originalQuantity: input.quantity,
        remainingQuantity: input.quantity,
        lotStatus: 'active',
        createdAt: now(),
        updatedAt: now()
      };
      s.pantryLots.push(lot);
      return lot;
    });
  }

  adjustPantryQuantity(meta: MutationMeta, lotId: string, delta: number) {
    return this.mutate(meta, 'PANTRY_QUANTITY_ADJUSTED', s => {
      const l = s.pantryLots.find(x => x.id === lotId);
      if (!l || l.remainingQuantity + delta < 0) throw Error('Invalid lot adjustment');
      l.remainingQuantity += delta;
      l.updatedAt = now();
      if (!l.remainingQuantity) l.lotStatus = 'depleted';
      return l;
    });
  }

  consumePantryLot(meta: MutationMeta, lotId: string, quantity = 1) {
    return this.mutate(meta, 'PANTRY_LOT_CONSUMED', s => {
      const l = s.pantryLots.find(x => x.id === lotId);
      if (!l) throw Error('Lot not found');
      const consumeQty = Math.min(quantity, l.remainingQuantity);
      l.remainingQuantity = Math.max(0, l.remainingQuantity - consumeQty);
      l.updatedAt = now();
      if (l.remainingQuantity <= 0) {
        l.lotStatus = 'depleted';
      }
      return l;
    });
  }

  consumePantryLots(meta: MutationMeta, name: string, quantity: number) {
    return this.mutate(meta, 'ITEM_CONSUMED', s => {
      let left = quantity;
      const used: { lotId: string; quantity: number }[] = [];
      for (const l of useFirstLots(s.pantryLots).filter(x => x.name.toLowerCase() === name.toLowerCase())) {
        const q = Math.min(left, l.remainingQuantity - l.reservedQuantity);
        if (q > 0) {
          l.remainingQuantity -= q;
          used.push({ lotId: l.id, quantity: q });
          left -= q;
          if (!l.remainingQuantity) l.lotStatus = 'depleted';
        }
        if (!left) break;
      }
      if (left) throw Error('Not enough usable inventory');
      return used;
    });
  }

  recordWaste(meta: MutationMeta, lotId: string, quantity: number) {
    return this.mutate(meta, 'ITEM_WASTED', s => {
      const l = s.pantryLots.find(x => x.id === lotId);
      if (!l || quantity > l.remainingQuantity) throw Error('Invalid waste quantity');
      l.remainingQuantity -= quantity;
      return l;
    });
  }

  recordLeftover(meta: MutationMeta, name: string, portions: number) {
    return this.addPantryLot(meta, {
      productId: `prepared-${name.toLowerCase().replace(/\W/g, '-')}`,
      name,
      category: 'prepared-food',
      quantity: portions,
      unit: 'portion',
      storageLocation: 'refrigerator',
      freshnessStatus: 'use-soon',
      freshnessConfidence: .8,
      freshnessEvidence: ['Confirmed after cooking'],
      reservedQuantity: 0
    });
  }

  logMeal(meta: MutationMeta, input: Omit<MealLog, 'id' | 'createdBy'>) {
    return this.mutate(meta, 'MEAL_LOGGED', s => {
      const meal = { ...input, id: crypto.randomUUID(), createdBy: meta.actorUid };
      s.mealLogs.push(meal);
      return meal;
    });
  }

  updateMealLog(meta: MutationMeta, id: string, patch: Partial<MealLog>) {
    return this.mutate(meta, 'MEAL_UPDATED', s => {
      const m = s.mealLogs.find(x => x.id === id);
      if (!m) throw Error('Meal not found');
      Object.assign(m, patch, { id: m.id });
      return m;
    });
  }

  addShoppingListItem(meta: MutationMeta, item: ShoppingItem) {
    return this.mutate(meta, 'SHOPPING_ITEM_ADDED', s => {
      s.shoppingItems.push(item);
      return item;
    });
  }

  updateShoppingListItem(meta: MutationMeta, id: string, patch: Partial<ShoppingItem>) {
    return this.mutate(meta, 'SHOPPING_ITEM_UPDATED', s => {
      const i = s.shoppingItems.find(x => x.id === id);
      if (!i) throw Error('Item not found');
      Object.assign(i, patch, { id: i.id });
      return i;
    });
  }

  createShoppingPlan(meta: MutationMeta, items: ShoppingItem[]) {
    return this.mutate(meta, 'SHOPPING_PLAN_CREATED', s => {
      s.shoppingItems.push(...items);
      return items;
    });
  }

  addCartItem(meta: MutationMeta, id: string) {
    return this.updateShoppingListItem(meta, id, { status: 'in-cart' });
  }

  markShoppingItemPurchased(meta: MutationMeta, id: string) {
    return this.mutate(meta, 'SHOPPING_ITEM_PURCHASED', s => {
      const item = s.shoppingItems.find(x => x.id === id);
      if (!item) throw Error('Item not found');
      item.status = 'purchased';
      // Automatically create pantry lot from purchased item
      const lot: PantryLot = {
        id: crypto.randomUUID(),
        productId: item.name.toLowerCase(),
        name: item.name,
        category: 'other',
        quantity: item.desiredQuantity || 1,
        originalQuantity: item.desiredQuantity || 1,
        remainingQuantity: item.desiredQuantity || 1,
        reservedQuantity: 0,
        unit: item.unit,
        storageLocation: 'pantry',
        freshnessStatus: 'fresh',
        freshnessConfidence: 0.9,
        freshnessEvidence: ['Marked purchased in shopping list'],
        lotStatus: 'active',
        createdAt: now(),
        updatedAt: now()
      };
      s.pantryLots.push(lot);
      return item;
    });
  }

  confirmPurchase(meta: MutationMeta, ids: string[]) {
    return this.mutate(meta, 'PURCHASE_CONFIRMED', s => {
      const items = s.shoppingItems.filter(i => ids.includes(i.id));
      items.forEach(i => i.status = 'purchased');
      return { purchaseId: crypto.randomUUID(), items };
    });
  }

  createPantryLotsFromPurchase(meta: MutationMeta, items: Array<{ name: string; quantity: number; unit: PantryLot['unit'] }>) {
    return this.mutate(meta, 'PANTRY_LOTS_FROM_PURCHASE', s => items.map(i => {
      const lot: PantryLot = {
        id: crypto.randomUUID(),
        productId: i.name.toLowerCase(),
        name: i.name,
        category: 'other',
        quantity: i.quantity,
        originalQuantity: i.quantity,
        remainingQuantity: i.quantity,
        reservedQuantity: 0,
        unit: i.unit,
        storageLocation: 'pantry',
        freshnessStatus: 'unknown',
        freshnessConfidence: 0,
        freshnessEvidence: ['Purchase confirmation'],
        lotStatus: 'active',
        createdAt: now(),
        updatedAt: now()
      };
      s.pantryLots.push(lot);
      return lot;
    }));
  }

  savePreferenceEvidence(meta: MutationMeta, value: string) {
    return this.mutate(meta, 'PREFERENCE_EVIDENCE_ADDED', s => {
      s.preferences.hypotheses.push(value);
      return value;
    });
  }

  confirmPreference(meta: MutationMeta, value: string) {
    return this.mutate(meta, 'PREFERENCE_CONFIRMED', s => {
      s.preferences.hypotheses = s.preferences.hypotheses.filter(x => x !== value);
      s.preferences.confirmed.push(value);
      return value;
    });
  }

  updateHabits(meta: MutationMeta | { actor?: string; timestamp?: string; trigger?: string }, patch: Partial<FamilyHabits>) {
    const m: MutationMeta = ('actorUid' in meta && meta.actorUid && 'householdId' in meta)
      ? (meta as MutationMeta)
      : mutationMeta('voice');

    return this.mutate(m, 'HABITS_UPDATED', s => {
      if (!s.familyHabits) {
        s.familyHabits = defaultFamilyHabits();
      }
      s.familyHabits = {
        ...s.familyHabits,
        ...patch,
        dietaryRestrictions: patch.dietaryRestrictions ?? s.familyHabits.dietaryRestrictions ?? [],
        favoriteMealIdeas: patch.favoriteMealIdeas ?? s.familyHabits.favoriteMealIdeas ?? [],
        spiceTolerance: patch.spiceTolerance ?? s.familyHabits.spiceTolerance ?? 'Medium Spice'
      };
      return s.familyHabits;
    });
  }

  // The structured `allergies` list is what every specialist's system prompt
  // is told to treat as a hard safety constraint (see the master prompt's
  // ALLERGY & DIETARY SAFETY rule) - but until this method existed, nothing
  // in the app ever actually wrote to it. A stated allergy only ever landed
  // in the free-text, 200-char-capped memoryNotes list, which the model has
  // to reliably re-parse out of loose prose on every future turn instead of
  // reading one reliable structured field. Adds (merges, case-insensitive
  // deduped) rather than replaces, so the model doesn't need perfect recall
  // of the existing list to safely record one new allergy.
  addAllergies(meta: MutationMeta | { actor?: string; timestamp?: string; trigger?: string }, allergies: string[]) {
    const m: MutationMeta = ('actorUid' in meta && meta.actorUid && 'householdId' in meta)
      ? (meta as MutationMeta)
      : mutationMeta('voice');
    const clean = allergies.map(a => a.trim()).filter(Boolean);
    if (clean.length === 0) return [];

    return this.mutate(m, 'ALLERGIES_UPDATED', s => {
      const existing = Array.isArray(s.allergies) ? s.allergies : [];
      const existingLower = new Set(existing.map(a => a.toLowerCase()));
      for (const a of clean) {
        if (!existingLower.has(a.toLowerCase())) {
          existing.push(a);
          existingLower.add(a.toLowerCase());
        }
      }
      s.allergies = existing;
      return s.allergies;
    });
  }

  // GDPR Data Portability (Article 20): Export entire user kitchen state as formatted JSON
  exportAllData(): {
    exportedAt: string;
    version: string;
    data: FoodMemoryState;
  } {
    const currentState = this.getState();
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      data: currentState
    };
  }

  // GDPR Right to Erasure (Article 17): Wipe all user kitchen records locally and from Firestore
  async eraseAllUserData(userId?: string): Promise<void> {
    if (this.activeCloudUnsub) {
      this.activeCloudUnsub();
      this.activeCloudUnsub = null;
    }

    if (userId) {
      try {
        await firebaseService.deleteUserData(userId);
      } catch (err) {
        console.warn('Error deleting cloud user data:', err);
      }
    }

    // Reset local memory state to blank
    const emptyState = emptyFoodMemory();
    localStorage.setItem(KEY, JSON.stringify(emptyState));
    localStorage.removeItem('benkut_display_name');
    localStorage.removeItem('benkut_consumer_account');
    localStorage.removeItem('benkut_user_id');
    localStorage.removeItem('benkut_user_email');
    localStorage.removeItem('benkut_sensory_consent');
    localStorage.removeItem('benkut_voice_sessions');

    window.dispatchEvent(new Event('benkut-memory'));
  }
}

export const foodMemoryService = new FoodMemoryService();

export const mutationMeta = (source: FoodSource, key = crypto.randomUUID()): MutationMeta => {
  const auth = getAuthSafe();
  const uid = auth?.currentUser?.uid || 'demo-user';
  return {
    actorUid: uid,
    householdId: 'household-' + uid,
    idempotencyKey: key,
    source
  };
};
