import React from 'react';
import { useTranslation } from '../utils/translate';

export default function LanguageSelector() {
  const { lang, changeLanguage } = useTranslation();

  return (
    <div className="flex bg-slate-900/80 border border-slate-800 rounded-lg p-0.5 shadow-inner">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-300 ${
          lang === 'en'
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('hi')}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-300 ${
          lang === 'hi'
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        हिंदी
      </button>
    </div>
  );
}
