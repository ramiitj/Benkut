import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppTourModal } from '../../components/AppTourModal';
import { AuthModal } from '../../components/AuthModal';
import { telemetryService } from '../../services/telemetryService';
import { ConsumerAccount } from '../../services/consumerAccount';
import { CULINARY_ENVIRONMENTS, CulinaryEnvironment } from '../../services/environmentalGreetingEngine';

const JOURNEY_STEPS: CulinaryEnvironment[] = ['pantry', 'supermarket', 'farm_market', 'countertop'];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [showTour, setShowTour] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const handleLaunch = () => {
    navigate('/chef');
  };

  const handleAuthSuccess = (_account: ConsumerAccount) => {
    telemetryService.logEvent('auth_success', { userId: _account.uid, userEmail: _account.email, language });
    navigate('/chef');
  };

  const specialists = [
    { title: t('specialist1Title'), sub: t('specialist1Sub'), desc: t('specialist1Desc'), icon: 'kitchen', iconBg: 'bg-emerald-600' },
    { title: t('specialist2Title'), sub: t('specialist2Sub'), desc: t('specialist2Desc'), icon: 'favorite', iconBg: 'bg-rose-500' },
    { title: t('specialist3Title'), sub: t('specialist3Sub'), desc: t('specialist3Desc'), icon: 'shopping_basket', iconBg: 'bg-orange-500' },
    { title: t('specialist4Title'), sub: t('specialist4Sub'), desc: t('specialist4Desc'), icon: 'mic', iconBg: 'bg-[#174F35]' }
  ];

  return (
    <div id="landing-page-unified" className="min-h-screen bg-[#F5F7F3] text-[#17231C] font-sans selection:bg-[#174F35] selection:text-white overflow-x-hidden">
      {/* Header */}
      <header id="landing-header" className="sticky top-0 z-40 bg-[#F5F7F3]/95 backdrop-blur-md border-b border-[#DFE5DF]">
        <div className="max-w-6xl mx-auto px-5 h-16 sm:h-20 flex items-center justify-between gap-2">
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

          <div className="flex items-center gap-3 sm:gap-5">
            <LanguageSelector />
            <button
              onClick={() => setShowAuth(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#174F35] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0E3826] transition active:scale-95 cursor-pointer shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero: headline + a real snapshot of the product, not just a claim about it */}
      <section id="landing-hero" className="pt-12 pb-16 sm:pt-20 sm:pb-24 px-5 overflow-hidden relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-[-10%] w-[560px] h-[560px] rounded-full bg-[#DFF36C]/25 blur-3xl"
        />
        <div className="max-w-6xl mx-auto relative grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#174F35]/25 bg-white px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#174F35] mb-5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#174F35]" />
              {t('landingTag')}
            </span>
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-[1.08] text-[#17231C] mb-4 sm:mb-5">
              {t('landingTitle')}{' '}
              <span className="text-[#174F35]">{t('landingTitleHighlight')}</span>
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-lg mx-auto lg:mx-0 mb-7 sm:mb-9">
              {t('landingSubtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 mb-4 justify-center lg:justify-start">
              <button
                id="landing-signin-btn"
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#174F35] px-6 py-3.5 sm:py-4 text-sm font-extrabold text-white shadow-xl shadow-[#174F35]/20 hover:bg-[#0E3826] transition active:scale-95 cursor-pointer w-full sm:w-auto"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span>{t('signInSignUp')}</span>
              </button>
              <button
                id="landing-hero-tour-link"
                onClick={() => setShowTour(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#DFE5DF] bg-white px-6 py-3.5 sm:py-4 text-sm font-bold text-stone-700 hover:border-[#174F35]/40 hover:text-[#174F35] transition active:scale-95 cursor-pointer w-full sm:w-auto"
              >
                <span className="material-symbols-outlined text-base">explore</span>
                <span>{t('guidedTourLink')}</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto lg:mx-0 leading-relaxed">
              Requires a verified kitchen account to sync pantry tables, shopping lists, and dietary memories securely across your devices.
            </p>
          </div>

          {/* Static, honest snapshot of the actual in-app voice cockpit - the same
              cards, colors, and copy shape a signed-in user would see, not a
              stand-in illustration. */}
          <div className="relative mx-auto w-full max-w-[340px]" aria-hidden="true">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[2.25rem] bg-[#174F35]/10" />
            <div className="relative rounded-[2.25rem] border border-[#DFE5DF] bg-white shadow-2xl p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="font-display font-black text-sm text-[#17231C]">Benkut</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase text-emerald-800 bg-emerald-100 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Ready on Countertop
                </span>
              </div>

              <div className="flex flex-col items-center py-2">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-[#174F35]/10 animate-pulse" />
                  <div className="relative w-16 h-16 rounded-full bg-[#174F35] text-white flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-2xl">mic</span>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-stone-700 mt-2">&ldquo;What can I make with what I have?&rdquo;</p>
              </div>

              <div className="rounded-2xl border border-[#DFE5DF] bg-[#F5F7F3] p-3 text-left space-y-1.5">
                <p className="text-[11px] text-stone-700 leading-snug">
                  You have tomatoes, onions, and rice — a fresh <strong>tomato pulao</strong> comes together in about 20 minutes. Want the steps?
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3 text-left">
                <p className="text-[9px] font-extrabold uppercase tracking-wide text-orange-700 mb-1.5">Missing for pulao</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Cumin seeds', 'Bay leaf'].map(item => (
                    <span key={item} className="text-[10px] font-bold bg-white border border-orange-200 text-orange-800 rounded-full px-2 py-0.5">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Journey: the four real environments the app already models, shown as
          one continuous day rather than a flat feature list. */}
      <section id="landing-journey" className="py-12 sm:py-14 px-5 bg-white border-y border-[#DFE5DF]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17231C] mb-2">
              One companion, everywhere food happens
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              Benkut recognizes where you are and adapts — same voice, same memory, four kitchens.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative">
            {JOURNEY_STEPS.map((envKey, idx) => {
              const env = CULINARY_ENVIRONMENTS[envKey];
              const trans = env.translations[language] || env.translations.English;
              return (
                <div key={envKey} className="relative flex flex-col items-center text-center">
                  {idx < JOURNEY_STEPS.length - 1 && (
                    <span className="hidden lg:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-[#DFE5DF]" aria-hidden="true" />
                  )}
                  <div className="relative w-12 h-12 rounded-2xl bg-[#F5F7F3] border border-[#DFE5DF] flex items-center justify-center text-[#174F35] mb-3">
                    <span className="material-symbols-outlined text-xl">{env.icon}</span>
                  </div>
                  <h3 className="font-display font-bold text-xs sm:text-sm text-[#17231C] mb-1">{trans.label}</h3>
                  <p className="text-[10.5px] sm:text-[11px] text-stone-500 leading-snug">{trans.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Unified Capabilities Section */}
      <section id="landing-capabilities" className="py-12 sm:py-16 px-5 bg-[#F5F7F3]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17231C] mb-2">
              {t('fourHelpersTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              {t('fourHelpersSub')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {specialists.map((pillar, idx) => (
              <div
                key={idx}
                id={`capability-card-${idx + 1}`}
                className="rounded-3xl bg-white border border-[#DFE5DF] p-5 flex flex-col hover:border-[#174F35]/40 hover:-translate-y-0.5 transition shadow-xs"
              >
                <div className={`w-11 h-11 rounded-2xl ${pillar.iconBg} text-white flex items-center justify-center shadow-md mb-4`}>
                  <span className="material-symbols-outlined text-xl">{pillar.icon}</span>
                </div>
                <h3 className="font-display font-black text-base text-[#17231C] mb-1">
                  {pillar.title}
                </h3>
                <p className="text-[10px] sm:text-[11px] font-bold text-[#174F35] mb-2.5 uppercase tracking-wide">
                  {pillar.sub}
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
      <section id="landing-privacy" className="py-10 sm:py-12 px-5 bg-white border-t border-[#DFE5DF]">
        <div className="max-w-3xl mx-auto text-center bg-[#F5F7F3] rounded-3xl p-6 sm:p-8 border border-[#DFE5DF]">
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
