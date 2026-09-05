(() => {
  const localeMap = {
    en: ['en', 'ltr'], ar: ['ar', 'rtl'], es: ['es', 'ltr'], fr: ['fr', 'ltr'], de: ['de', 'ltr'],
    ru: ['ru', 'ltr'], zh: ['zh-CN', 'ltr'], hi: ['hi', 'ltr'], id: ['id', 'ltr'], ur: ['ur', 'rtl'],
    ja: ['ja', 'ltr'], pt: ['pt', 'ltr'], it: ['it', 'ltr'], ko: ['ko', 'ltr'], nl: ['nl', 'ltr'],
    pl: ['pl', 'ltr'], tr: ['tr', 'ltr'], vi: ['vi', 'ltr'], th: ['th', 'ltr'], sv: ['sv', 'ltr'],
    ms: ['ms', 'ltr'], uk: ['uk', 'ltr'],
  };
  const candidate = window.location.pathname.split('/').filter(Boolean)[0] || 'en';
  const [lang, dir] = localeMap[candidate] || localeMap.en;
  const html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', dir);
  html.setAttribute('data-flixo-locale', candidate in localeMap ? candidate : 'en');
})();
