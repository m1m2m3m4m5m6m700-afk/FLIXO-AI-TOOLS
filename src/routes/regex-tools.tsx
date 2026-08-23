import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/regex-tester');
if (!tool) throw new Error('Missing ToolConfig for /en/regex-tester');
const ToolComponent = tool.component;

export const enRegexTesterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/regex-tester',
  head: () => ({ meta: [{ title: 'Regex Tester & Debugger | FLIXO' }, { name: 'description', content: tool.description }] }),
  component: () => <ToolComponent />,
});
