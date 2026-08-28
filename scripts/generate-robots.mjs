import { mkdirSync, writeFileSync } from 'node:fs';
import { getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';

const origin = getCanonicalSiteOrigin();
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
mkdirSync('public', { recursive: true });
writeFileSync('public/robots.txt', robots, 'utf8');
console.log(`Generated robots.txt for ${origin}`);
