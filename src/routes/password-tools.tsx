import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/password-generator');
if (!tool) throw new Error('Missing ToolConfig for /en/password-generator');
if (!tool.isReady) throw new Error('Password Generator route is not ready');
const Component = tool.component;

export const enPasswordGeneratorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/password-generator',
  head: () => ({ meta: [
    { title: 'Password Generator | FLIXO' },
    { name: 'description', content: 'Generate secure passwords locally using Web Crypto.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
  ] }),
  component: () => <Component />,
});
