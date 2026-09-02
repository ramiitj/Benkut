import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppTourModal } from '../../components/AppTourModal';
import { AuthModal } from '../../components/AuthModal';
import { telemetryService } from '../../services/telemetryService';
import { ConsumerAccount } from '../../services/consumerAccount';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [showTour, setShowTour] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const handleLaunch = () => {
    navigate('/chef');
  };

  const handleGuestLaunch = () => {
    // Persistent guest ID for continuous local memory & database telemetry tracking
    let guestUid = '';
    try {
      guestUid = localStorage.getItem('benkut_guest_uid') || '';
      if (!guestUid) {
        guestUid = 'guest-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('benkut_guest_uid', guestUid);
      }
      localStorage.setItem('benkut_user_id', guestUid);
      localStorage.setItem('benkut_user_email', 'guest@benkut.local');
    } catch {
      guestUid = 'guest-session';
    }

    // Log telemetry for analytics and admin reporting
    telemetryService.logEvent('auth_success', {
      userId: guestUid,
      userEmail: 'guest@benkut.local',
      language,
      details: { method: 'guest_link', mode: 'guest' }
    });

    navigate('/chef');
  };

  const handleAuthSuccess = (_account: ConsumerAccount) => {
    navigate('/chef');
  };

  const corePillars = [
    {
      name: 'Inventory & Freshness',
      summary: 'Pantry & Fridge Tracking',
      icon: 'kitchen',
      iconBg: 'bg-emerald-600 text-white',
      desc: 'Recognizes pantry staples and fresh groceries by camera or voice, tracking freshness and preventing food waste.'
    },
    {
      name: 'Market Shopping',
      summary: 'Checklists & Produce Inspection',
      icon: 'shopping_basket',
      iconBg: 'bg-orange-500 text-white',
      desc: 'Keeps your grocery list synchronized with missing ingredients and evaluates produce quality with the camera at the market.'
    },
    {
      name: 'Hands-Free Cooking',
      summary: 'Live Countertop Guidance',
      icon: 'restaurant',
      iconBg: 'bg-[#174F35] text-white',
      desc: 'Guides recipes step-by-step with spoken voice, timers, and substitutions while your hands are busy chopping or stirring.'
    },
    {
      name: 'Family Food Memory',
      summary: 'Preferences & Restrictions',
      icon: 'favorite',
      iconBg: 'bg-rose-500 text-white',
      desc: 'Remembers household allergies, preferred spice levels, and cultural tastes so every meal idea fits your family.'
    }
  ];

  return (
    <div id="landing-page-unified" className="min-h-screen bg-[#F5F7F3] text-[#17231C] font-sans selection:bg-[#174F35] selection:text-white overflow-x-hidden">
      {/* Header */}
      <header id="landing-header" className="sticky top-0 z-40 bg-[#F5F7F3]/95 backdrop-blur-md border-b border-[#DFE5DF]">
        <div className="max-w-5xl mx-auto px-5 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-left group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-[#174F35] flex items-center justify-center text-[#DFF36C] shadow-sm">
              <span className="material-symbols-outlined text-lg sm:text-xl">mic</span>
            </div>
            <div>
              <span className="font-display font-black text-lg sm:text-xl tracking-tight text-[#17231C] block leading-none">
                Benkut
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-widest text-[#174F35]">
                {t('kitchenAssistant')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            <LanguageSelector />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="landing-hero" className="pt-10 pb-14 sm:pt-20 sm:pb-24 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl tracking-tighter leading-[1.15] text-[#17231C] mb-3 sm:mb-5">
            {t('landingTitle')} <br className="hidden sm:block" />
            <span className="text-[#174F35]">{t('landingTitleHighlight')}</span>
          </h1>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-xl mx-auto mb-6 sm:mb-10">
            {t('landingSubtitle')}
          </p>

          <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 mb-6">
            <button
              id="landing-signin-btn"
              onClick={() => setShowAuth(true)}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#174F35] px-6 py-3.5 sm:py-4 text-sm font-extrabold text-white shadow-xl shadow-[#174F35]/20 hover:bg-[#0E3826] transition active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>Sign In / Sign Up</span>
            </button>
            <p className="text-[11px] text-stone-500 max-w-xs leading-relaxed text-center">
              Requires a verified kitchen account to sync pantry tables, shopping lists, and dietary memories securely across your devices.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <button
              id="landing-hero-tour-link"
              onClick={() => setShowTour(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#174F35] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#174F35]">explore</span>
              <span>{t('guidedTourLink')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Unified Capabilities Section */}
      <section id="landing-capabilities" className="py-12 sm:py-16 px-5 bg-white border-y border-[#DFE5DF]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17231C] mb-2">
              One Unified Kitchen Companion
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              Engage naturally by voice or camera — seamlessly managing your food from market to countertop with unified memory.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {corePillars.map((pillar, idx) => (
              <div
                key={idx}
                id={`capability-card-${idx + 1}`}
                className="rounded-3xl bg-[#F5F7F3] border border-[#DFE5DF] p-5 flex flex-col hover:border-[#174F35]/40 transition shadow-xs"
              >
                <div className={`w-11 h-11 rounded-2xl ${pillar.iconBg} flex items-center justify-center shadow-md mb-4`}>
                  <span className="material-symbols-outlined text-xl">{pillar.icon}</span>
                </div>
                <h3 className="font-display font-black text-base text-[#17231C] mb-1">
                  {pillar.name}
                </h3>
                <p className="text-[10px] sm:text-[11px] font-bold text-[#174F35] mb-2.5 uppercase tracking-wide">
                  {pillar.summary}
                </p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section id="landing-privacy" className="py-10 sm:py-12 px-5 bg-[#F5F7F3]">
        <div className="max-w-3xl mx-auto text-center bg-white rounded-3xl p-6 sm:p-8 border border-[#DFE5DF] shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-xl">lock</span>
          </div>
          <h3 className="font-display font-bold text-base sm:text-lg text-stone-900 mb-2">
            {t('privacyTitle')}
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-xl mx-auto">
            {t('privacySub')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-5 text-center text-xs text-stone-500 border-t border-[#DFE5DF]">
        <p>{t('footerText')}</p>
      </footer>

      {/* Modals */}
      <AppTourModal
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleLaunch}
      />
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onAuthenticated={handleAuthSuccess}
      />
    </div>
  );
};

export default LandingPage;

