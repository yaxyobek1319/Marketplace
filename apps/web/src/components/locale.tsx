'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
type Locale = 'uz' | 'ru';
const Context = createContext<{
  locale: Locale;
  setLocale: (v: Locale) => void;
  t: (uz: string, ru: string) => string;
}>({ locale: 'uz', setLocale: () => {}, t: (uz) => uz });
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, set] = useState<Locale>('uz');
  useEffect(() => {
    if (localStorage.getItem('mp_locale') === 'ru') set('ru');
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = (value: Locale) => {
    set(value);
    localStorage.setItem('mp_locale', value);
  };
  return (
    <Context.Provider value={{ locale, setLocale, t: (uz, ru) => (locale === 'uz' ? uz : ru) }}>
      {children}
    </Context.Provider>
  );
}
export const useLocale = () => useContext(Context);
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <button
      className="language"
      onClick={() => setLocale(locale === 'uz' ? 'ru' : 'uz')}
      aria-label={locale === 'uz' ? 'Tilni almashtirish' : 'Сменить язык'}
    >
      {locale === 'uz' ? 'O‘zbekcha' : 'Русский'} <span>⌄</span>
    </button>
  );
}
