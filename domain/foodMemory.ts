export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'each' | 'portion';
export type StorageLocation = 'pantry' | 'refrigerator' | 'freezer' | 'counter' | 'other';
export type FreshnessStatus = 'fresh' | 'use-soon' | 'use-first' | 'possibly-deteriorating' | 'expired' | 'unknown';
export type FoodSource = 'manual' | 'voice' | 'photo' | 'barcode' | 'receipt' | 'chef' | 'fresh' | 'migration';

export interface MutationMeta { actorUid: string; householdId: string; idempotencyKey: string; source: FoodSource; }
export interface PantryLot {
  id: string; productId: string; name: string; category: string; quantity: number; originalQuantity: number;
  remainingQuantity: number; reservedQuantity: number; unit: Unit; storageLocation: StorageLocation;
  purchaseDate?: string; expiryDate?: string; estimatedFreshUntil?: string; freshnessStatus: FreshnessStatus;
  freshnessConfidence: number; freshnessEvidence: string[]; purchaseReference?: string; price?: number; currency?: string;
  lotStatus: 'active' | 'depleted' | 'discarded'; createdAt: string; updatedAt: string;
}
export interface MealLog { id: string; eatenAt: string; mealType: string; items: string[]; portionEstimate?: number; source: 'home'|'restaurant'|'packaged'|'other'; cookingSessionId?: string; pantryConsumptionConfirmed: boolean; notes?: string; createdBy: string; }
export interface ShoppingItem { id: string; name: string; reason: 'meal-plan'|'direct-request'|'restock'|'substitute'; desiredQuantity: number; availableQuantity: number; missingQuantity: number; unit: Unit; status: 'needed'|'in-cart'|'purchased'; }
export interface FoodEvent { eventId: string; eventType: string; householdId: string; actorUid: string; occurredAt: string; createdAt: string; source: FoodSource; idempotencyKey: string; confidence: number; payload: Record<string, unknown>; schemaVersion: 1; }
export interface FamilyHabits {
  dietaryRestrictions: string[];
  favoriteMealIdeas: string[];
  spiceTolerance: string;
  householdSize?: number;
  healthGoals?: string[];
}

export interface FoodMemoryState {
  pantryLots: PantryLot[];
  mealLogs: MealLog[];
  shoppingItems: ShoppingItem[];
  shoppingList?: ShoppingItem[];
  familyHabits?: FamilyHabits;
  events: FoodEvent[];
  allergies: string[];
  preferences: { confirmed: string[]; hypotheses: string[] };
  /** Short durable facts the agent chose to remember across turns (allergies,
   * standing preferences, recurring requests) - synced to Firestore like the
   * rest of this state, so they persist across devices once signed in. */
  memoryNotes: string[];
}

export const defaultFamilyHabits = (): FamilyHabits => ({
  dietaryRestrictions: ['Vegetarian / Flexitarian'],
  favoriteMealIdeas: ['Fresh Vegetable Stir-Fry', 'Lentil Soup', 'Steamed Rice with Veggies'],
  spiceTolerance: 'Medium Spice',
  householdSize: 2,
  healthGoals: ['Eat more fresh vegetables', 'Reduce food waste']
});

export const emptyFoodMemory = (): FoodMemoryState => {
  const defaultHabits = defaultFamilyHabits();
  return {
    pantryLots: [],
    mealLogs: [],
    shoppingItems: [],
    shoppingList: [],
    familyHabits: defaultHabits,
    events: [],
    allergies: [],
    preferences: { confirmed: [], hypotheses: [] },
    memoryNotes: []
  };
};
export const usableQuantity = (lots: PantryLot[], product: string) => lots.filter(l => l.name.toLowerCase() === product.toLowerCase() && l.lotStatus === 'active' && l.freshnessStatus !== 'expired').reduce((n, l) => n + Math.max(0, l.remainingQuantity - l.reservedQuantity), 0);
export const useFirstLots = (lots: PantryLot[]) => [...lots].filter(l => l.lotStatus === 'active' && l.freshnessStatus !== 'expired').sort((a,b) => (a.expiryDate || a.estimatedFreshUntil || '9999').localeCompare(b.expiryDate || b.estimatedFreshUntil || '9999'));
export const calculateUnitPrice = (price: number, quantity: number) => { if (price < 0 || quantity <= 0) throw new Error('Price and quantity must be valid'); return price / quantity; };
export const planItem = (lots: PantryLot[], name: string, desiredQuantity: number, unit: Unit, direct = false): ShoppingItem | null => {
  const availableQuantity = usableQuantity(lots, name);
  const missingQuantity = direct ? desiredQuantity : Math.max(0, desiredQuantity - availableQuantity);
  if (!direct && missingQuantity === 0) return null;
  return { id: crypto.randomUUID(), name, reason: direct ? 'direct-request' : 'meal-plan', desiredQuantity, availableQuantity, missingQuantity, unit, status: 'needed' };
};
