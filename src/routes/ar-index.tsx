import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { AgentFirstHome } from '../components/AgentFirstHome';
import { buildSeoMetadata } from '../lib/seo';

const SEO = buildSeoMetadata({ locale:'ar', path:'/', title:'FLIXO | وكيل ذكاء اصطناعي لإنجاز مهامك', description:'تحدث مع FLIXO واترك له فهم المهمة والتخطيط لاستخدام الأدوات المناسبة.' });

export const arIndexRoute = createRoute({
  getParentRoute:()=>rootRoute,
  path:'/ar/',
  head:()=>({meta:[{title:SEO.title},{name:'description',content:SEO.description},{name:'robots',content:'index,follow,max-image-preview:large'},{property:'og:title',content:SEO.title},{property:'og:description',content:SEO.description},{property:'og:type',content:'website'},{property:'og:url',content:SEO.canonical},{property:'og:locale',content:SEO.language}],links:[{rel:'canonical',href:SEO.canonical},...SEO.alternates.map(({hreflang,href})=>({rel:'alternate',hrefLang:hreflang,href}))]}),
  component:()=> <AgentFirstHome locale="ar" />,
});
