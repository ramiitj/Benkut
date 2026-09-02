import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface AppTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish?: () => void;
  onComplete?: () => void;
}

export const AppTourModal: React.FC<AppTourModalProps> = ({ isOpen, onClose, onFinish, onComplete }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);

  const handleFinish = () => {
    if (onComplete) onComplete();
    if (onFinish) onFinish();
    onClose();
  };

  const steps = [
    {
      badge: t('landingTag'),
      icon: 'restaurant_menu',
      iconBg: 'bg-[#174F35]',
      iconColor: 'text-[#DFF36C]',
      heading: t('headline'),
      description: t('subhead'),
      tips: [
        t('tagline'),
        t('speakRepliesAloud'),
        t('privacySub')
      ]
    },
    {
      badge: `${t('specialist1Title')} (${t('specialist1Sub')})`,
      icon: 'kitchen',
      iconBg: 'bg-emerald-600',
      iconColor: 'text-white',
      heading: t('specialist1Title'),
      description: t('specialist1Desc'),
      tips: [
        `"${t('suggestionPantry1')}"`,
        `"${t('suggestionPantry2')}"`,
        t('checkFoodHint')
      ]
    },
    {
      badge: `${t('specialist2Title')} (${t('specialist2Sub')})`,
      icon: 'favorite',
      iconBg: 'bg-rose-500',
      iconColor: 'text-white',
      heading: t('specialist2Title'),
      description: t('specialist2Desc'),
      tips: [
        `"${t('suggestionNutrition1')}"`,
        `"${t('suggestionNutrition2')}"`,
        `"${t('suggestionNutrition3')}"`
      ]
    },
    {
      badge: `${t('specialist3Title')} (${t('specialist3Sub')})`,
      icon: 'shopping_basket',
      iconBg: 'bg-orange-500',
      iconColor: 'text-white',
      heading: t('specialist3Title'),
      description: t('specialist3Desc'),
      tips: [
        `"${t('suggestionShopping1')}"`,
        `"${t('suggestionShopping2')}"`,
        t('shopSmartHint')
      ]
    },
    {
      badge: `${t('specialist4Title')} (${t('specialist4Sub')})`,
      icon: 'skillet',
      iconBg: 'bg-[#174F35]',
      iconColor: 'text-white',
      heading: t('specialist4Title'),
      description: t('specialist4Desc'),
      tips: [
        `"${t('suggestionChef1')}"`,
        `"${t('suggestionChef2')}"`,
        t('cookNowHint')
      ]
    }
  ];

  if (!isOpen) return null;

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(c => c + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(c => c - 1);
    }
  };

  return (
    <div id="tour-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in overscroll-contain">
      <div id="tour-modal-card" className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[32px] bg-white text-stone-900 shadow-2xl border border-stone-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-[#E8F1E9]/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#174F35] uppercase tracking-wider">
              {t('howItWorks')} · {currentStep + 1} / {steps.length}
            </span>
          </div>
          <button
            id="tour-modal-close-btn"
            onClick={onClose}
            className="rounded-full bg-white p-2 text-stone-400 hover:text-stone-700 shadow-sm"
            aria-label={t('close')}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${step.iconBg} ${step.iconColor} shadow-md`}>
              <span className="material-symbols-outlined text-3xl">{step.icon}</span>
            </div>
            <div>
              <span className="inline-block rounded-full bg-stone-100 px-3 py-0.5 text-[11px] font-bold text-stone-700 mb-1">
                {step.badge}
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black text-stone-900 leading-tight">
                {step.heading}
              </h2>
            </div>
          </div>

          <p className="text-sm text-stone-600 leading-relaxed font-medium">
            {step.description}
          </p>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
              {t('promptSuggestionsTitle')}
            </span>
            <ul className="space-y-2 text-xs text-stone-700 font-medium">
              {step.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm text-[#174F35] mt-0.5 shrink-0">check_circle</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Progress & Navigation Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-6 py-4">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-6 bg-[#174F35]' : 'w-2 bg-stone-300'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                ←
              </button>
            )}
            <button
              id="tour-modal-next-btn"
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-[#174F35] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#0E3826] transition"
            >
              {currentStep === steps.length - 1 ? t('startCooking') : `${t('seeAll')} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppTourModal;
