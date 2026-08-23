import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ArHomePage } from './ar-home-page';

export const arIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/',
  head: () => ({
    meta: [
      { title: 'FLIXO | أدوات سريعة وخصوصية أولًا' },
      { name: 'description', content: 'اكتشف أدوات سريعة للصور والذكاء الاصطناعي وOCR والتحويل وغيرها، مع معالجة محلية داخل المتصفح عندما تكون مدعومة.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: 'FLIXO | أدوات سريعة وخصوصية أولًا' },
      { property: 'og:description', content: 'أدوات متصفح سريعة مع تجربة عربية مريحة وخصوصية أولًا.' },
      { property: 'og:locale', content: 'ar' },
    ],
    links: [
      { rel: 'canonical', href: '/ar/' },
      { rel: 'alternate', hrefLang: 'en', href: '/' },
      { rel: 'alternate', hrefLang: 'ar', href: '/ar/' },
      { rel: 'alternate', hrefLang: 'x-default', href: '/' },
    ],
  }),
  component: ArHomePage,
});
