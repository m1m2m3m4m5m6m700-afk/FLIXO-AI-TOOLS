import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const family = process.env.LIGHTHOUSE_FAMILY?.trim();
const locale = process.env.LIGHTHOUSE_LOCALE?.trim();
const baseUrl = process.env.LIGHTHOUSE_BASE_URL?.trim();

if (!family || !locale || !baseUrl) throw new Error('LIGHTHOUSE_FAMILY, LIGHTHOUSE_LOCALE and LIGHTHOUSE_BASE_URL are required.');

const manifestModule = await import(pathToFileURL(`${process.cwd()}/src/config/tool-manifest.ts`).href);
const config = await import(pathToFileURL(`${process.cwd()}/src/lib/i18n/config.ts`).href);
const tools = [...(manifestModule.TOOL_MANIFEST ?? [])].filter((tool) => tool.isReady !== false && tool.family === family);
if (!config.LOCALES?.includes(locale)) throw new Error(`Unknown locale in Lighthouse shard: ${locale}`);
if (!tools.length) throw new Error(`No ready tools found for Lighthouse family: ${family}`);

const outDir = join('diagnostics', 'lighthouse', family, locale);
mkdirSync(outDir, { recursive: true });
const floors = { performance: 0.80, accessibility: 0.90, 'best-practices': 0.90, seo: 0.90 };
const failures = [];

for (const tool of tools) {
  const path = tool.path.replace(/^\/en(?=\/|$)/u, `/${locale}`);
  if (!path.startsWith(`/${locale}/`)) {
    failures.push(`${tool.id}:${locale}: invalid canonical route ${tool.path}`);
    continue;
  }
  const reportPath = join(outDir, `${tool.id}.json`);
  console.log(`LIGHTHOUSE ${family}/${locale}: ${path}`);
  const result = spawnSync('npx', [
    '--yes', 'lighthouse@13.4.1', `${baseUrl}${path}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json', `--output-path=${reportPath}`,
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
  ], { stdio: 'inherit', encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${tool.id}:${locale}: Lighthouse process exited ${result.status ?? 'unknown'}`);
    continue;
  }

  const report = JSON.parse((await import('node:fs')).readFileSync(reportPath, 'utf8'));
  for (const [category, floor] of Object.entries(floors)) {
    const score = report.categories?.[category]?.score ?? 0;
    console.log(`  ${category}: ${score.toFixed(3)} (floor ${floor.toFixed(2)})`);
    if (score < floor) failures.push(`${tool.id}:${locale}:${category} ${score.toFixed(3)}<${floor.toFixed(2)}`);
  }
}

console.log(`LIGHTHOUSE SHARD COMPLETE: family=${family} locale=${locale} routes=${tools.length}`);
if (failures.length) {
  console.error(`LIGHTHOUSE SHARD FAIL: ${failures.length} blocking failure(s)`);
  for (const failure of failures.slice(0, 200)) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log('LIGHTHOUSE SHARD PASS: every ready route in this family/locale met all category floors.');
