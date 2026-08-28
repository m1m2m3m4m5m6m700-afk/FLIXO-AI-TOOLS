import { mkdirSync, writeFileSync } from 'node:fs';
import { SITE_ORIGIN } from '../src/lib/i18n/config.ts';

const origin = new URL(SITE_ORIGIN);
if (origin.protocol !== 'https:') {
  throw new Error('robots.txt canonical origin must use HTTPS.');
}

if (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1' || origin.hostname.endsWith('.vercel.app') && origin.hostname !== 'flexoai.vercel.app') {
  throw new Error(`robots.txt must not use a preview/test origin: ${origin.origin}`);
}

const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin.origin}/sitemap.xml\n`;
mkdirSync('public', { recursive: true });
writeFileSync('public/robots.txt', robots, 'utf8');
console.log(`Generated robots.txt for ${origin.origin}`);
