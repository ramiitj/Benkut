import React, { useState } from 'react';
import { signInWithGoogleSafe } from '../services/firebase';
import { authenticateConsumer, ConsumerAccount } from '../services/consumerAccount';
import { useLanguage } from '../contexts/LanguageContext';
import { telemetryService } from '../services/telemetryService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (account: ConsumerAccount) => void;
  title?: string;
  subtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  title,
  subtitle
}) => {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const modalTitle = title || t('signInSignUp');
  const modalSubtitle = subtitle || t('landingSubtitle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const account = await authenticateConsumer(mode, email.trim(), password);
      telemetryService.logEvent('auth_success', {
        userId: account.uid,
        userEmail: account.email,
        language,
        details: { method: 'email', mode }
      });
      onAuthenticated(account);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in could not complete');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogleSafe();
      if (user) {
        const account: ConsumerAccount = {
          uid: user.uid,
          email: user.email || 'user@benkut.com',
          storageConsent: true,
          authenticatedAt: new Date().toISOString()
        };
        telemetryService.logEvent('auth_success', {
          userId: user.uid,
          userEmail: user.email,
          language,
          details: { method: 'google' }
        });
        onAuthenticated(account);
        onClose();
      } else {
        throw new Error('Google sign-in was cancelled.');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Google sign-in error';
      if (errorMsg.includes('popup') || errorMsg.includes('Cross-Origin') || errorMsg.includes('cross-origin')) {
        setError('Google sign-in popup is restricted in this preview iframe. Please use Email / Password to sign in or create your account.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumberOrSpecial;
  const isSubmitDisabled = loading || (mode === 'signup' && !isPasswordValid);

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3.5 sm:p-4 backdrop-blur-sm animate-fade-in overscroll-contain">
      <div id="auth-modal-card" className="relative w-full max-w-md max-h-[96dvh] overflow-y-auto overscroll-contain rounded-[28px] sm:rounded-[32px] bg-white p-5 sm:p-7 shadow-2xl border border-stone-200">
        <button
          id="auth-modal-close-btn"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition cursor-pointer"
          aria-label={t('close')}
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#174F35] text-[#DFF36C] mx-auto flex items-center justify-center mb-2 shadow-sm">
            <span className="material-symbols-outlined text-xl">account_circle</span>
          </div>
          <h2 className="text-lg sm:text-xl font-display font-black text-stone-900 leading-tight">{modalTitle}</h2>
          <p className="text-[11px] text-stone-500 max-w-xs mx-auto leading-tight mt-0.5">{modalSubtitle}</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-xl bg-stone-100 p-1 mb-3.5 border border-stone-200">
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              mode === 'signup' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              mode === 'signin' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Sign In
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-[11px] rounded-xl font-medium border border-red-200 flex items-start gap-2">
            <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* 1. Google Auth at the Top */}
        <div className="mb-3.5">
          <button
            id="auth-google-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full min-h-[42px] rounded-xl border border-stone-300 bg-white py-2 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative my-3 text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
            <span className="relative bg-white px-2.5 text-[9px] font-bold text-stone-400 uppercase tracking-wider">or email</span>
          </div>
        </div>

        {/* 2. Custom Sign In / Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">{t('email')}</label>
            <input
              id="auth-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 font-medium focus:border-[#174F35] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Password</label>
            <input
              id="auth-password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 font-medium focus:border-[#174F35] focus:bg-white focus:outline-none"
            />
            {mode === 'signup' && (
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px]">
                <span className={`inline-flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-stone-400'}`}>
                  <span className="material-symbols-outlined text-[11px]">{hasMinLength ? 'check' : 'circle'}</span>
                  8+ chars
                </span>
                <span className={`inline-flex items-center gap-1 ${hasUppercase ? 'text-emerald-700 font-bold' : 'text-stone-400'}`}>
                  <span className="material-symbols-outlined text-[11px]">{hasUppercase ? 'check' : 'circle'}</span>
                  1 uppercase
                </span>
                <span className={`inline-flex items-center gap-1 ${hasNumberOrSpecial ? 'text-emerald-700 font-bold' : 'text-stone-400'}`}>
                  <span className="material-symbols-outlined text-[11px]">{hasNumberOrSpecial ? 'check' : 'circle'}</span>
                  1 num/special
                </span>
              </div>
            )}
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full min-h-[44px] rounded-xl bg-[#174F35] py-2.5 text-xs font-bold text-white shadow-md shadow-[#174F35]/20 hover:bg-[#0E3826] transition active:scale-95 disabled:opacity-40 cursor-pointer mt-1"
          >
            {loading ? 'Processing...' : mode === 'signup' ? 'Create Account & Continue' : 'Sign In & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
