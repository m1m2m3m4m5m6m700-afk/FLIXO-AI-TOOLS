import type { ToolManifest } from '@/lib/seo/tool-manifest';
export const BACKGROUND_BLUR_MANIFEST: ToolManifest = Object.freeze({
  toolId: 'background-blur', slug: 'background-blur', status: 'ready', seoStatus: 'pilot',
  capabilities: ['client-side', 'blur', 'image', 'png', 'jpg', 'webp'] as const,
  seoLocales: Object.freeze({
    en: require('./seo/en').en, ar: require('./seo/ar').ar, es: require('./seo/es').es, fr: require('./seo/fr').fr,
    de: require('./seo/de').de, ru: require('./seo/ru').ru, zh: require('./seo/zh').zh, hi: require('./seo/hi').hi,
    id: require('./seo/id').id, ur: require('./seo/ur').ur, ja: require('./seo/ja').ja, pt: require('./seo/pt').pt,
    it: require('./seo/it').it, ko: require('./seo/ko').ko, nl: require('./seo/nl').nl, pl: require('./seo/pl').pl,
    tr: require('./seo/tr').tr, vi: require('./seo/vi').vi, th: require('./seo/th').th, sv: require('./seo/sv').sv,
  }),
});
