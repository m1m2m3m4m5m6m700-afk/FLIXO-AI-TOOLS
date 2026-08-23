import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/case-converter');
if (!tool) throw new Error('Missing ToolConfig for /en/case-converter');
if (!tool.isReady) throw new Error('Case Converter route is not ready');
const Component = tool.component;

export const enCaseConverterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/case-converter',
  head: () => ({ meta: [
    { title: 'Case Converter | FLIXO' },
    { name: 'description', content: 'Convert text between common letter and identifier cases locally.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Case Converter | FLIXO' },
    { property: 'og:description', content: 'Convert text between common letter and identifier cases locally.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <Component />,
});
