(() => {
  const localeMap = {
    en: ['en', 'ltr'], ar: ['ar', 'rtl'], es: ['es', 'ltr'], fr: ['fr', 'ltr'], de: ['de', 'ltr'],
    ru: ['ru', 'ltr'], zh: ['zh-CN', 'ltr'], hi: ['hi', 'ltr'], id: ['id', 'ltr'], ur: ['ur', 'rtl'],
    ja: ['ja', 'ltr'], pt: ['pt', 'ltr'], it: ['it', 'ltr'], ko: ['ko', 'ltr'], nl: ['nl', 'ltr'],
    pl: ['pl', 'ltr'], tr: ['tr', 'ltr'], vi: ['vi', 'ltr'], th: ['th', 'ltr'], sv: ['sv', 'ltr'],
    ms: ['ms', 'ltr'], uk: ['uk', 'ltr'],
  };

  const resolveLocale = () => {
    const candidate = window.location.pathname.split('/').filter(Boolean)[0] || 'en';
    return localeMap[candidate] || localeMap.en;
  };

  const applyLocale = () => {
    const html = document.documentElement;
    const [lang, dir] = resolveLocale();
    if (html.getAttribute('lang') !== lang) html.setAttribute('lang', lang || 'en');
    if (html.getAttribute('dir') !== dir) html.setAttribute('dir', dir || 'ltr');
  };

  applyLocale();

  const guard = new MutationObserver(() => applyLocale());
  guard.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir'],
  });
})();
