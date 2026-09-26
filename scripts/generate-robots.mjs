import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_ORIGIN = 'https://flixoai.vercel.app';
const configuredOrigin =
  process.env.SITE_ORIGIN?.trim() ||
  process.env.VITE_SITE_URL?.trim() ||
  DEFAULT_ORIGIN;

let origin;
try {
  const parsed = new URL(configuredOrigin);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('origin must not contain credentials, query parameters, or fragments');
  }
  if (parsed.protocol !== 'https:') throw new Error('origin must use HTTPS');
  origin = parsed.origin;
} catch (error) {
  throw new Error(
    `Invalid SITE_ORIGIN/VITE_SITE_URL: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}

const outputDir = process.env.FLIXO_GENERATED_OUTPUT_DIR?.trim() || 'public';
const robots = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'robots.txt'), robots, 'utf8');
console.log(`Generated robots.txt for ${origin} at ${outputDir}/robots.txt`);
