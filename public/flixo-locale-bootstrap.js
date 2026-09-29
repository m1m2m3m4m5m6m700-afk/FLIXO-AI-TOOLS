/* global window, document, console */
(() => {
  const localeMap = {
    en: ['en', 'ltr'], ar: ['ar', 'rtl'], es: ['es', 'ltr'], fr: ['fr', 'ltr'], de: ['de', 'ltr'],
    hi: ['hi', 'ltr'], id: ['id', 'ltr'], it: ['it', 'ltr'], ja: ['ja', 'ltr'], ko: ['ko', 'ltr'],
    ms: ['ms', 'ltr'], nl: ['nl', 'ltr'], pl: ['pl', 'ltr'], pt: ['pt', 'ltr'], ru: ['ru', 'ltr'],
    sv: ['sv', 'ltr'], th: ['th', 'ltr'], tr: ['tr', 'ltr'], uk: ['uk', 'ltr'], vi: ['vi', 'ltr'],
  };
  const candidate = window.location.pathname.split('/').filter(Boolean)[0] || 'en';
  const [lang, dir] = localeMap[candidate] || localeMap.en;
  const html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', dir);
  html.setAttribute('data-flixo-locale', localeMap[candidate] ? candidate : 'en');
})();
