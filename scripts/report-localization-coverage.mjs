import { existsSync, readdirSync, readFileSync } from 'node:fs';

const locales = ['en', 'ar', 'es', 'fr', 'de', 'ru', 'zh', 'hi', 'id', 'ur', 'ja', 'pt', 'it', 'ko', 'nl', 'pl', 'tr', 'vi', 'th', 'sv'];
const toolsSource = readFileSync('src/config/tools.ts', 'utf8');
const readyToolIds = [...toolsSource.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);

const rows = readyToolIds.map((toolId) => {
  const seoDir = `src/tools/${toolId}/seo`;
  const files = existsSync(seoDir) ? new Set(readdirSync(seoDir).filter((name) => name.endsWith('.ts')).map((name) => name.replace(/\.ts$/, ''))) : new Set();
  const present = locales.filter((locale) => files.has(locale));
  return {
    toolId,
    present: present.length,
    total: locales.length,
    missing: locales.filter((locale) => !files.has(locale)),
    complete: present.length === locales.length,
  };
});

const completeTools = rows.filter((row) => row.complete).length;
const averageCoverage = rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.present / row.total, 0) / rows.length;

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  localeCount: locales.length,
  readyToolCount: rows.length,
  completeToolCount: completeTools,
  completeToolPercent: rows.length === 0 ? 0 : Number(((completeTools / rows.length) * 100).toFixed(2)),
  averageLocaleCoveragePercent: Number((averageCoverage * 100).toFixed(2)),
  tools: rows,
}, null, 2));
