import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { FlixoAgentPage } from '../components/FlixoAgentPage';
import { buildSeoMetadata } from '@/lib/seo';

const SEO = buildSeoMetadata({
  locale: 'en',
  path: '/agent',
  title: 'FLIXO | AI Agent',
  description: 'Chat with the FLIXO image-editing agent and execute supported image workflows.',
});

export const agentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agent',
  head: () => ({
    meta: [
      { title: SEO.title },
      { name: 'description', content: SEO.description },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: SEO.title },
      { property: 'og:description', content: SEO.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SEO.canonical },
    ],
    links: [{ rel: 'canonical', href: SEO.canonical }],
  }),
  component: () => <FlixoAgentPage locale="en" />,
});
