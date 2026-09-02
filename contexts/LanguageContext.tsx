import React, { createContext, useContext, useMemo, useState } from 'react';
import en from '../i18n/en';
import hi from '../i18n/hi';
import es from '../i18n/es';
import te from '../i18n/te';
import fr from '../i18n/fr';

export type SupportedLanguage = 'English' | 'తెలుగు' | 'हिन्दी' | 'Español' | 'Français';

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  bcp47: string;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  English: { code: 'en', name: 'English', nativeName: 'English', bcp47: 'en-US' },
  'తెలుగు': { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', bcp47: 'te-IN' },
  'हिन्दी': { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', bcp47: 'hi-IN' },
  'Español': { code: 'es', name: 'Spanish', nativeName: 'Español', bcp47: 'es-ES' },
  'Français': { code: 'fr', name: 'French', nativeName: 'Français', bcp47: 'fr-FR' },
};

const resources: Record<string, any> = {
  en,
  te,
  hi,
  es,
  fr,
};

type Resource = typeof en;

type LanguageContextState = {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  langInfo: LanguageInfo;
  interfaceLanguage: string;
  conversationLanguage: string;
  locked: boolean;
  setInterfaceLanguage: (v: string) => void;
  setConversationLanguage: (v: string) => void;
  setLocked: (v: boolean) => void;
  t: (key: string) => string;
  dict: any;
};

const LanguageContext = createContext<LanguageContextState | null>(null);

const getStorage = (k: string, f: string) => {
  try { return localStorage.getItem(k) || f; } catch { return f; }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = getStorage('benkut_language', 'English') as SupportedLanguage;
    return SUPPORTED_LANGUAGES[saved] ? saved : 'English';
  });

  const [conversationLanguage, setConversation] = useState(() => getStorage('benkut-conversation-language', 'en-US'));
  const [locked, setLock] = useState(() => getStorage('benkut-language-locked', 'false') === 'true');

  const langInfo = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES['English'];
  const dict = resources[langInfo.code] || en;

  const setLanguage = (newLang: SupportedLanguage) => {
    if (SUPPORTED_LANGUAGES[newLang]) {
      setLanguageState(newLang);
      try {
        localStorage.setItem('benkut_language', newLang);
        localStorage.setItem('benkut-interface-language', SUPPORTED_LANGUAGES[newLang].code);
      } catch {
        // ignore
      }
    }
  };

  const setInterfaceLanguage = (code: string) => {
    const found = Object.keys(SUPPORTED_LANGUAGES).find(
      (k) => SUPPORTED_LANGUAGES[k as SupportedLanguage].code === code
    ) as SupportedLanguage;
    if (found) setLanguage(found);
  };

  const t = (key: string): string => {
    if (dict && dict[key]) return dict[key];
    if (en && (en as any)[key]) return (en as any)[key];
    return key;
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      langInfo,
      interfaceLanguage: langInfo.code,
      conversationLanguage,
      locked,
      setInterfaceLanguage,
      setConversationLanguage: (v: string) => {
        try { localStorage.setItem('benkut-conversation-language', v); } catch {}
        setConversation(v);
      },
      setLocked: (v: boolean) => {
        try { localStorage.setItem('benkut-language-locked', String(v)); } catch {}
        setLock(v);
      },
      t,
      dict,
    }),
    [language, langInfo, conversationLanguage, locked]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const v = useContext(LanguageContext);
  if (!v) throw Error('LanguageProvider missing');
  return v;
};
