import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { AgentFirstHome } from '../components/AgentFirstHome';
import { buildSeoMetadata } from '../lib/seo';

const SEO = buildSeoMetadata({ locale:'en', path:'/', title:'FLIXO | AI agent for your creative work', description:'Tell FLIXO what you want to accomplish. FLIXO plans the work and uses available tools to get it done.' });

export const indexRoute = createRoute({
  getParentRoute:()=>rootRoute,
  path:'/',
  head:()=>({meta:[{title:SEO.title},{name:'description',content:SEO.description},{name:'robots',content:'index,follow,max-image-preview:large'},{property:'og:title',content:SEO.title},{property:'og:description',content:SEO.description},{property:'og:type',content:'website'},{property:'og:url',content:SEO.canonical}],links:[{rel:'canonical',href:SEO.canonical},...SEO.alternates.map(({hreflang,href})=>({rel:'alternate',hrefLang:hreflang,href}))]}),
  component:AgentFirstHome,
});
