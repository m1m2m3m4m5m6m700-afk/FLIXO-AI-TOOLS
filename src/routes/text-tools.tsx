import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const textDiffTool = getToolConfigByPath('/en/text-diff-checker');
if (!textDiffTool) throw new Error('Missing ToolConfig for /en/text-diff-checker');
if (!textDiffTool.isReady) throw new Error('Text Diff Checker route is not ready');
const TextDiffComponent = textDiffTool.component;

export const enTextDiffCheckerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/text-diff-checker',
  head: () => ({ meta: [
    { title: 'Text Diff Checker | FLIXO' },
    { name: 'description', content: 'Compare two texts locally with inline or side-by-side differences.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Text Diff Checker | FLIXO' },
    { property: 'og:description', content: 'Compare two texts locally with inline or side-by-side differences.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <TextDiffComponent />,
});
