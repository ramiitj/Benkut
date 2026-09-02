import React from 'react';
import { useLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from '../contexts/LanguageContext';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <span className="material-symbols-outlined text-stone-400 text-sm absolute left-2.5 pointer-events-none">
        translate
      </span>
      <select
        id="language-selector-dropdown"
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        className="bg-white/80 hover:bg-white border border-[#DFE5DF] text-stone-800 text-xs font-bold rounded-xl pl-8 pr-7 py-2 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#174F35] shadow-xs transition"
        title="Select Language / భాష ఎంచుకోండి"
      >
        {Object.keys(SUPPORTED_LANGUAGES).map((langKey) => {
          const info = SUPPORTED_LANGUAGES[langKey as SupportedLanguage];
          return (
            <option key={langKey} value={langKey} className="text-stone-900 font-medium py-1">
              {info.nativeName} ({info.name})
            </option>
          );
        })}
      </select>
      <span className="material-symbols-outlined text-stone-400 text-xs absolute right-2 pointer-events-none">
        expand_more
      </span>
    </div>
  );
};
