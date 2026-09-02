import React from 'react';
import { useLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from '../contexts/LanguageContext';
import { ConsumerAccount } from '../services/consumerAccount';
import { CulinaryEnvironment, CULINARY_ENVIRONMENTS } from '../services/environmentalGreetingEngine';

interface KitchenSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: ConsumerAccount | null;
  onOpenProfile: () => void;
  onOpenTour: () => void;
  onClearSession: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  voiceGender?: 'female' | 'male';
  onChangeVoiceGender?: (gender: 'female' | 'male') => void;
  environment?: CulinaryEnvironment;
  onChangeEnvironment?: (env: CulinaryEnvironment) => void;
}

export const KitchenSettingsModal: React.FC<KitchenSettingsModalProps> = ({
  isOpen,
  onClose,
  account,
  onOpenProfile,
  onOpenTour,
  onClearSession,
  isMuted,
  onToggleMute,
  voiceGender = 'female',
  onChangeVoiceGender,
  environment = 'countertop',
  onChangeEnvironment,
}) => {
  const { language, setLanguage, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      id="kitchen-settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3.5 sm:p-4 backdrop-blur-sm animate-fade-in overscroll-contain"
    >
      <div
        id="kitchen-settings-modal-card"
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-[28px] sm:rounded-[32px] bg-white text-stone-900 shadow-2xl border border-stone-200 text-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 bg-[#F5F7F3]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#174F35] text-[#DFF36C] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">tune</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 leading-tight">Kitchen & Voice Settings</h2>
              <span className="text-[10px] text-stone-500 block font-medium">Preferences, environment, and assistant mode</span>
            </div>
          </div>

          <button
            id="kitchen-settings-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition flex items-center justify-center cursor-pointer"
            aria-label={t('close')}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Culinary Environment Selection */}
          {onChangeEnvironment && (
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#174F35] mb-2">
                Active Culinary Environment / Location
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CULINARY_ENVIRONMENTS) as CulinaryEnvironment[]).map((envKey) => {
                  const item = CULINARY_ENVIRONMENTS[envKey];
                  const trans = item.translations[language] || item.translations.English;
                  const isSelected = environment === envKey;
                  return (
                    <button
                      key={envKey}
                      type="button"
                      id={`modal-env-select-${envKey}`}
                      onClick={() => onChangeEnvironment(envKey)}
                      className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#174F35] text-white border-[#174F35] shadow-xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-base shrink-0 mt-0.5 ${isSelected ? 'text-[#DFF36C]' : 'text-stone-500'}`}>
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block leading-tight truncate">{trans.label}</span>
                        <span className={`text-[9px] block leading-tight mt-0.5 ${isSelected ? 'text-stone-200' : 'text-stone-400'}`}>
                          {trans.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Language Selection */}
          <div className="border-t border-stone-100 pt-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#174F35] mb-2">
              Conversational & App Language
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]).map((langKey) => {
                const info = SUPPORTED_LANGUAGES[langKey];
                const isSelected = language === langKey;
                return (
                  <button
                    key={langKey}
                    type="button"
                    onClick={() => setLanguage(langKey)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-start cursor-pointer ${
                      isSelected
                        ? 'bg-[#174F35] text-white border-[#174F35] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <span className="text-xs">{info.nativeName}</span>
                    <span className={`text-[10px] font-normal ${isSelected ? 'text-[#DFF36C]' : 'text-stone-400'}`}>
                      {info.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound & Speech */}
          <div className="border-t border-stone-100 pt-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#174F35] mb-2">
              Gemini Voice & Speech
            </label>
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 mb-2">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-stone-700 text-lg">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    {isMuted ? 'Voice Muted' : 'Gemini Voice Enabled'}
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {isMuted ? 'Benkut replies with text only' : 'Spoken aloud using Gemini native audio'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  isMuted
                    ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                    : 'bg-[#174F35] text-white hover:bg-[#0E3826]'
                }`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>

            {/* Voice Gender Selection */}
            {!isMuted && onChangeVoiceGender && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => onChangeVoiceGender('female')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    voiceGender === 'female'
                      ? 'bg-[#174F35] text-white border-[#174F35] shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">face_3</span>
                    <div className="text-left">
                      <span className="block text-xs font-bold">Woman (Kore)</span>
                      <span className={`text-[9px] block ${voiceGender === 'female' ? 'text-[#DFF36C]' : 'text-stone-400'}`}>
                        Gemini Warm Female
                      </span>
                    </div>
                  </div>
                  {voiceGender === 'female' && (
                    <span className="material-symbols-outlined text-sm text-[#DFF36C]">check_circle</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onChangeVoiceGender('male')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    voiceGender === 'male'
                      ? 'bg-[#174F35] text-white border-[#174F35] shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">face_6</span>
                    <div className="text-left">
                      <span className="block text-xs font-bold">Man (Puck)</span>
                      <span className={`text-[9px] block ${voiceGender === 'male' ? 'text-[#DFF36C]' : 'text-stone-400'}`}>
                        Gemini Deep Male
                      </span>
                    </div>
                  </div>
                  {voiceGender === 'male' && (
                    <span className="material-symbols-outlined text-sm text-[#DFF36C]">check_circle</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Dietary & Family Habits */}
          <div className="border-t border-stone-100 pt-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#174F35] mb-2">
              Dietary Restrictions & Allergies
            </label>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 hover:bg-stone-100 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-stone-700 text-lg">restaurant_menu</span>
                <div>
                  <span className="text-xs font-bold text-stone-900 block">Edit Dietary Preferences</span>
                  <span className="text-[10px] text-stone-500">Vegetarian, Vegan, Nut Allergies, Spice level</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-stone-400 text-base">chevron_right</span>
            </button>
          </div>

          {/* Guided Tour */}
          <div className="border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTour();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 hover:bg-stone-100 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-stone-700 text-lg">help</span>
                <div>
                  <span className="text-xs font-bold text-stone-900 block">How Benkut Works</span>
                  <span className="text-[10px] text-stone-500">Quick 1-minute voice companion overview</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-stone-400 text-base">chevron_right</span>
            </button>
          </div>

          {/* Clear Session */}
          <div className="border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onClearSession();
              }}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition text-xs font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>Start Fresh / Clear Current Session</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-stone-100 bg-[#F5F7F3] px-5 py-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#174F35] py-2.5 text-xs font-extrabold text-white hover:bg-[#0E3826] transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitchenSettingsModal;
