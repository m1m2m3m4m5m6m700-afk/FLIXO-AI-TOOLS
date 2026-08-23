import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const wordCounterTool = getToolConfigByPath('/en/word-character-counter');
if (!wordCounterTool) throw new Error('Missing ToolConfig for /en/word-character-counter');
if (!wordCounterTool.isReady) throw new Error('Word & Character Counter route is not ready');
const WordCounterComponent = wordCounterTool.component;

export const enWordCharacterCounterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/word-character-counter',
  head: () => ({ meta: [
    { title: 'Word & Character Counter | FLIXO' },
    { name: 'description', content: 'Count words, characters, sentences, paragraphs, and keyword density locally.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Word & Character Counter | FLIXO' },
    { property: 'og:description', content: 'Count words, characters, sentences, paragraphs, and keyword density locally.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <WordCounterComponent />,
});
