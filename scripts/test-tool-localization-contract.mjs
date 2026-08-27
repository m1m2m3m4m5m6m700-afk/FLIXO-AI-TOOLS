import { getReadyToolConfigs } from '../src/config/tools.ts';
import { LOCALES } from '../src/lib/i18n/config.ts';
import { localizeToolTitle, localizeToolDescription, localizeToolCategory } from '../src/lib/i18n/tool-localization.ts';

const tools = getReadyToolConfigs();
const failures = [];
for (const tool of tools) {
  for (const locale of LOCALES) {
    const title = localizeToolTitle(locale, tool.title, tool.category);
    const description = localizeToolDescription(locale, tool.title, tool.category);
    const category = localizeToolCategory(locale, tool.category);
    if (!title.trim() || !description.trim() || !category.trim()) failures.push(`${tool.id}:${locale}:empty metadata`);
    if (locale !== 'en' && title === tool.title) failures.push(`${tool.id}:${locale}:english title leaked`);
    if (locale !== 'en' && description === tool.description) failures.push(`${tool.id}:${locale}:english description leaked`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Tool localization contract passed for ${tools.length} tools × ${LOCALES.length} locales.`);
