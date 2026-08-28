import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const origin = getCanonicalSiteOrigin();
const outputDir = process.env.FLIXO_GENERATED_OUTPUT_DIR?.trim() || 'public';
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'robots.txt'), robots, 'utf8');
console.log(`Generated robots.txt for ${origin} at ${outputDir}/robots.txt`);
