import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ArabicImageCompressorPage } from '../tools/image-compressor/locale-pages';

export const arImageCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/image-compressor',
  head: () => ({
    meta: [
      { title: 'ضغط الصور أونلاين مجانًا | FLIXO' },
      { name: 'description', content: 'اضغط صور JPG وPNG وWebP أونلاين داخل المتصفح. قلّل حجم الملفات وتحكم في الجودة والمقاسات بدون رفع الصور إلى خادم.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: 'ضغط الصور أونلاين مجانًا | FLIXO' },
      { property: 'og:description', content: 'قلّل حجم الصور داخل المتصفح مع التحكم في الجودة والمقاسات.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: '/ar/image-compressor' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      { rel: 'canonical', href: '/ar/image-compressor' },
      { rel: 'alternate', hrefLang: 'en', href: '/en/image-compressor' },
      { rel: 'alternate', hrefLang: 'ar', href: '/ar/image-compressor' },
      { rel: 'alternate', hrefLang: 'x-default', href: '/en/image-compressor' },
    ],
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'FLIXO ضاغط الصور',
        url: '/ar/image-compressor',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        description: 'اضغط صور JPG وPNG وWebP أونلاين داخل المتصفح.',
        inLanguage: 'ar',
        isAccessibleForFree: true,
      }),
    }],
  }),
  component: ArabicImageCompressorPage,
});
