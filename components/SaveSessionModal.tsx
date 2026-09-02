import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInToSave: () => void;
  onExitWithoutSaving: () => void;
  turnCount?: number;
}

export const SaveSessionModal: React.FC<SaveSessionModalProps> = ({
  isOpen,
  onClose,
  onSignInToSave,
  onExitWithoutSaving,
  turnCount = 0,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      id="save-session-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3.5 sm:p-4 backdrop-blur-sm animate-fade-in overscroll-contain"
    >
      <div
        id="save-session-modal-card"
        className="relative w-full max-w-md rounded-[28px] sm:rounded-[32px] bg-white p-5 sm:p-7 shadow-2xl border border-stone-200 text-center"
      >
        <button
          id="save-session-close-btn"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition cursor-pointer"
          aria-label={t('close')}
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>

        {/* Icon & Heading */}
        <div className="w-12 h-12 rounded-2xl bg-[#E8F1E9] text-[#174F35] mx-auto flex items-center justify-center mb-3 shadow-xs">
          <span className="material-symbols-outlined text-2xl">save_as</span>
        </div>

        <h3 className="font-display font-black text-lg sm:text-xl text-stone-900 mb-1.5">
          Save this cooking session?
        </h3>

        <p className="text-xs text-stone-600 leading-relaxed max-w-sm mx-auto mb-4">
          You are currently in <strong>Guest mode</strong>. If you want to permanently save your recipe steps, pantry updates, and custom food preferences to your profile, please sign in or create an account.
        </p>

        {turnCount > 0 && (
          <div className="mb-4 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-center justify-around font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#174F35]">chat</span>
              <span>{turnCount} cooking turns</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">cloud_sync</span>
              <span>Cloud backup available</span>
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            id="save-session-signin-btn"
            onClick={onSignInToSave}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#174F35] py-3 px-4 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-[#174F35]/20 hover:bg-[#0E3826] transition active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            <span>Sign In / Sign Up to Save</span>
          </button>

          <button
            id="save-session-exit-btn"
            onClick={onExitWithoutSaving}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 py-2.5 px-4 text-xs sm:text-sm font-bold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Exit without saving</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveSessionModal;
