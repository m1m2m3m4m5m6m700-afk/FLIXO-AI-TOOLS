import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const siteOrigin = 'https://flexoai.vercel.app';
const locales = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
const toolsSource = readFileSync('src/config/tools.ts', 'utf8');
const readyToolIds = [...toolsSource.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);

const urls = [`${siteOrigin}/`];
for (const locale of locales) {
  urls.push(`${siteOrigin}/${locale}`);
  for (const toolId of readyToolIds) urls.push(`${siteOrigin}/${locale}/${toolId}`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;

mkdirSync('public', { recursive: true });
writeFileSync('public/sitemap.xml', xml, 'utf8');
console.log(`Generated sitemap with ${urls.length} URLs (${readyToolIds.length} ready tools × ${locales.length} locales + ${locales.length + 1} home URLs).`);
