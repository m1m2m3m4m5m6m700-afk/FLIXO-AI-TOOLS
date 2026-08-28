import { pathToFileURL } from 'node:url';

const config = await import(pathToFileURL(`${process.cwd()}/src/lib/i18n/config.ts`).href);
const manifestModule = await import(pathToFileURL(`${process.cwd()}/src/config/tool-manifest.ts`).href);

const locales = [...(config.LOCALES ?? [])];
const manifest = [...(manifestModule.TOOL_MANIFEST ?? [])];
const readyTools = manifest.filter((tool) => tool.isReady !== false);
const families = [...new Set(readyTools.map((tool) => tool.family))].sort();

if (!locales.length) throw new Error('Lighthouse matrix generation failed: LOCALES is empty.');
if (!readyTools.length) throw new Error('Lighthouse matrix generation failed: TOOL_MANIFEST has no ready tools.');

const matrix = [];
for (const family of families) {
  for (const locale of locales) matrix.push({ family, locale });
}

if (matrix.length > 256) {
  throw new Error(`Lighthouse matrix generation failed: ${matrix.length} jobs exceeds GitHub Actions matrix limit.`);
}

const output = JSON.stringify({ include: matrix });
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${output}\n`);
}

console.log(`LIGHTHOUSE MATRIX: ${readyTools.length} ready tools × ${locales.length} locales`);
console.log(`LIGHTHOUSE MATRIX: ${families.length} tool families × ${locales.length} locales = ${matrix.length} isolated jobs`);
console.log(`LIGHTHOUSE MATRIX FAMILIES: ${families.join(', ')}`);
console.log(output);
