import React, { useState, useEffect } from 'react';
import { useLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from '../contexts/LanguageContext';
import { ConsumerAccount } from '../services/consumerAccount';
import { foodMemoryService } from '../services/foodMemoryService';
import { telemetryService } from '../services/telemetryService';
import { firebaseService } from '../services/firebase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: ConsumerAccount | null;
  onAccountChange: (account: ConsumerAccount | null) => void;
  autoSpeak?: boolean;
  setAutoSpeak?: (speak: boolean) => void;
}

type TabType = 'profile' | 'consent' | 'gdpr';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  account,
  onAccountChange,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('benkut_display_name') || (account?.email ? account.email.split('@')[0] : 'Kitchen Chef');
  });
  const [dietary, setDietary] = useState('Vegetarian');
  const [spice, setSpice] = useState('Medium Spice');
  const [allergies, setAllergies] = useState('');
  const [favoriteMeals, setFavoriteMeals] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sensory Consent States
  const [voiceConsent, setVoiceConsent] = useState(true);
  const [cameraConsent, setCameraConsent] = useState(true);
  const [telemetryConsent, setTelemetryConsent] = useState(true);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const state = foodMemoryService.getState();
      setDietary(state?.familyHabits?.dietaryRestrictions?.[0] || 'Vegetarian');
      setSpice(state?.familyHabits?.spiceTolerance || 'Medium Spice');
      setAllergies(state?.allergies?.join(', ') || '');
      setFavoriteMeals(state?.familyHabits?.favoriteMealIdeas?.join(', ') || '');
      const storedName = localStorage.getItem('benkut_display_name') || (account?.email ? account.email.split('@')[0] : 'Kitchen Chef');
      setDisplayName(storedName);

      try {
        const rawConsent = localStorage.getItem('benkut_sensory_consent');
        if (rawConsent) {
          const parsed = JSON.parse(rawConsent);
          if (typeof parsed.voice === 'boolean') setVoiceConsent(parsed.voice);
          if (typeof parsed.camera === 'boolean') setCameraConsent(parsed.camera);
          if (typeof parsed.telemetry === 'boolean') setTelemetryConsent(parsed.telemetry);
        }
      } catch {
        // use defaults
      }
      setShowDeleteConfirm(false);
    }
  }, [isOpen, account]);

  if (!isOpen) return null;

  const memoryState = foodMemoryService.getState();
  const pantryCount = memoryState.pantryLots?.length || 0;
  const shoppingCount = (memoryState.shoppingList?.length || memoryState.shoppingItems?.length) || 0;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('benkut_display_name', displayName);

    const allergyList = allergies
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    const favMealList = favoriteMeals
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    // GDPR Article 16: Rectify dietary, taste, and allergy preferences
    foodMemoryService.updateHabits(
      { actor: 'user', timestamp: new Date().toISOString(), trigger: 'manual' },
      {
        dietaryRestrictions: [dietary],
        spiceTolerance: spice as any,
        favoriteMealIdeas: favMealList,
      }
    );

    // Save Sensory Consents
    localStorage.setItem('benkut_sensory_consent', JSON.stringify({
      voice: voiceConsent,
      camera: cameraConsent,
      telemetry: telemetryConsent,
      updatedAt: new Date().toISOString(),
    }));

    telemetryService.logEvent('agent_select', {
      userId: account?.uid || 'user',
      userEmail: account?.email || 'user',
      specialist: 'habits',
      language,
      details: { displayName, dietary, spice, allergyList, voiceConsent, cameraConsent }
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  // GDPR Article 20: Data Portability Export
  const handleExportData = () => {
    const exportPayload = foodMemoryService.exportAllData();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportPayload, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `benkut-kitchen-data-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // GDPR Article 17: Right to Erasure
  const handleDeleteAccountAndData = async () => {
    setIsDeleting(true);
    try {
      await foodMemoryService.eraseAllUserData(account?.uid);
      onAccountChange(null);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.warn('Error during account erasure:', err);
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseService.signOut();
    } catch {
      // ignore
    }
    localStorage.removeItem('benkut_consumer_account');
    localStorage.removeItem('benkut_user_id');
    localStorage.removeItem('benkut_user_email');
    onAccountChange(null);
    onClose();
  };

  return (
    <div id="profile-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in overscroll-contain">
      <div id="profile-modal-card" className="relative w-full max-w-xl max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[32px] bg-white p-6 sm:p-8 shadow-2xl border border-stone-200 flex flex-col">
        <button
          id="profile-modal-close-btn"
          onClick={onClose}
          className="absolute top-5 right-5 flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition cursor-pointer"
          aria-label={t('close')}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-stone-100">
          <div className="w-12 h-12 rounded-2xl bg-[#174F35] text-[#DFF36C] flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-2xl">account_circle</span>
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-stone-900">User Profile & Privacy Controls</h2>
            <p className="text-xs text-stone-500">Dietary preferences, sensory consent, and GDPR data management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-stone-100 p-1 rounded-2xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'profile' ? 'bg-white text-[#174F35] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">restaurant</span>
            <span>Profile & Tastes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consent')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'consent' ? 'bg-white text-[#174F35] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">verified_user</span>
            <span>Sensory Consent</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gdpr')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'gdpr' ? 'bg-white text-[#174F35] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">lock_reset</span>
            <span>GDPR Data</span>
          </button>
        </div>

        {/* TAB 1: Profile & Rectification (GDPR Art. 16) */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Quick Stats Overview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F5F7F3] p-3 border border-[#DFE5DF]">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-0.5">{t('itemsInPantry')}</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-700 text-base">kitchen</span>
                  <span className="text-base font-black text-stone-900">{pantryCount} items</span>
                </div>
              </div>
              <div className="rounded-2xl bg-[#F5F7F3] p-3 border border-[#DFE5DF]">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-0.5">{t('itemsOnShoppingList')}</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-600 text-base">shopping_basket</span>
                  <span className="text-base font-black text-stone-900">{shoppingCount} items</span>
                </div>
              </div>
            </div>

            {/* Sync Status Banner */}
            <div className="p-3 rounded-2xl text-xs flex items-center gap-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="material-symbols-outlined text-base">cloud_done</span>
              <span className="font-semibold flex-1">
                {account ? `${t('accountSynced')}: ${account.email}` : 'Kitchen Account Connected'}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">{t('displayName')}</label>
              <input
                id="profile-display-name-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 font-medium focus:border-[#174F35] focus:bg-white focus:outline-none"
                placeholder="Your culinary name"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">{t('defaultLanguage')}</label>
              <select
                id="profile-language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 font-bold focus:border-[#174F35] focus:bg-white focus:outline-none cursor-pointer"
              >
                {Object.keys(SUPPORTED_LANGUAGES).map((key) => {
                  const info = SUPPORTED_LANGUAGES[key as SupportedLanguage];
                  return (
                    <option key={key} value={key}>
                      {info.nativeName} ({info.name})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">{t('dietaryPreference')}</label>
                <select
                  id="profile-dietary-select"
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#174F35] focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="All Foods / No Restrictions">All Foods / No Restrictions</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Gluten-Free">Gluten-Free</option>
                  <option value="Halal">Halal</option>
                  <option value="Dairy-Free">Dairy-Free</option>
                  <option value="Pescatarian">Pescatarian</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">{t('spiceLevel')}</label>
                <select
                  id="profile-spice-select"
                  value={spice}
                  onChange={(e) => setSpice(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#174F35] focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="Mild Spice">Mild / Low Spice</option>
                  <option value="Medium Spice">Medium Spice</option>
                  <option value="High Spice">High / Authentic Spice</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Known Allergies (comma-separated)</label>
              <input
                id="profile-allergies-input"
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Peanuts, Shellfish, Soy"
                className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 font-medium focus:border-[#174F35] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Favorite Meal Ideas</label>
              <input
                id="profile-fav-meals-input"
                type="text"
                value={favoriteMeals}
                onChange={(e) => setFavoriteMeals(e.target.value)}
                placeholder="e.g. Dal Tadka, Grilled Veggies, Pasta Primavera"
                className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 font-medium focus:border-[#174F35] focus:bg-white focus:outline-none"
              />
            </div>

            {savedSuccess && (
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {t('savedSuccessfully')}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                id="profile-save-btn"
                type="submit"
                className="flex-1 min-h-[44px] rounded-xl bg-[#174F35] py-2.5 text-xs font-bold text-white shadow-md shadow-[#174F35]/20 hover:bg-[#0E3826] transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {t('saveChanges')}
              </button>
              {account && (
                <button
                  id="profile-signout-btn"
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[44px] px-4 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs font-bold hover:bg-stone-100 transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  {t('signOut')}
                </button>
              )}
            </div>
          </form>
        )}

        {/* TAB 2: Sensory Processing Consent Management */}
        {activeTab === 'consent' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-stone-50 p-4 border border-stone-200 text-xs text-stone-600 leading-relaxed">
              <span className="font-bold text-stone-900 block mb-1">Culinary AI Sensory Consent</span>
              Benkut processes audio and visual feeds locally and in realtime solely for kitchen coaching, recipe step guidance, and pantry inventory tracking. You can manage sensory permissions at any time.
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-stone-200 bg-white">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-emerald-700 text-xl mt-0.5">mic</span>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Voice & Audio Processing</span>
                    <span className="text-[11px] text-stone-500 block leading-tight">Allows hands-free listening and real-time culinary dialogue while cooking.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={voiceConsent}
                  onChange={(e) => setVoiceConsent(e.target.checked)}
                  className="w-5 h-5 rounded text-[#174F35] focus:ring-[#174F35] mt-1 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-stone-200 bg-white">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-xl mt-0.5">photo_camera</span>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Camera & Vision Inspection</span>
                    <span className="text-[11px] text-stone-500 block leading-tight">Allows inspecting pantry shelves, produce freshness, and ingredient labels via the back camera.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cameraConsent}
                  onChange={(e) => setCameraConsent(e.target.checked)}
                  className="w-5 h-5 rounded text-[#174F35] focus:ring-[#174F35] mt-1 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-stone-200 bg-white">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-xl mt-0.5">query_stats</span>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Operational Quality Telemetry</span>
                    <span className="text-[11px] text-stone-500 block leading-tight">Allows logging anonymous operational metrics to improve voice recognition and cooking step fidelity.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={telemetryConsent}
                  onChange={(e) => setTelemetryConsent(e.target.checked)}
                  className="w-5 h-5 rounded text-[#174F35] focus:ring-[#174F35] mt-1 cursor-pointer"
                />
              </div>
            </div>

            <button
              id="consent-save-btn"
              type="button"
              onClick={handleSaveProfile}
              className="w-full min-h-[44px] rounded-xl bg-[#174F35] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0E3826] transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <span className="material-symbols-outlined text-base">check</span>
              <span>Update Consent Preferences</span>
            </button>
          </div>
        )}

        {/* TAB 3: GDPR Compliance (Art. 20 Portability & Art. 17 Erasure) */}
        {activeTab === 'gdpr' && (
          <div className="space-y-4">
            {/* Data Portability Section */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-emerald-700 text-lg">download</span>
                <span className="text-xs font-black text-stone-900 uppercase tracking-wider">GDPR Data Portability (Article 20)</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed mb-3">
                Download a complete, machine-readable JSON copy of all your kitchen inventory, shopping items, logged meals, and dietary profile data.
              </p>
              <button
                id="gdpr-export-data-btn"
                type="button"
                onClick={handleExportData}
                className="w-full min-h-[44px] rounded-xl bg-white border border-[#174F35] text-[#174F35] py-2.5 text-xs font-bold hover:bg-emerald-50 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-base">file_download</span>
                <span>Export My Kitchen Data (JSON)</span>
              </button>
            </div>

            {/* Right to Erasure Section */}
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-2 text-red-800">
                <span className="material-symbols-outlined text-lg">delete_forever</span>
                <span className="text-xs font-black uppercase tracking-wider">Right to Erasure (Article 17)</span>
              </div>
              <p className="text-[11px] text-red-700 leading-relaxed mb-3">
                Permanently purge your account, pantry database records, shopping lists, meal logs, and taste profiles across cloud and local storage.
              </p>

              {!showDeleteConfirm ? (
                <button
                  id="gdpr-delete-trigger-btn"
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full min-h-[44px] rounded-xl bg-red-600 text-white py-2.5 text-xs font-bold hover:bg-red-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Delete My Account & Culinary Data</span>
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-white rounded-xl border border-red-300 animate-fade-in">
                  <span className="text-xs font-bold text-red-900 block">Are you absolutely sure? This action is irreversible.</span>
                  <div className="flex gap-2">
                    <button
                      id="gdpr-confirm-delete-btn"
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteAccountAndData}
                      className="flex-1 min-h-[40px] rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-800 transition cursor-pointer disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="min-h-[40px] px-3 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
