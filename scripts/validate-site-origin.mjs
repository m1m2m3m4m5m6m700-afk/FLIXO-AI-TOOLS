import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const configured = process.env.VITE_SITE_URL?.trim();
const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
const isCanonicalCi =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_WORKFLOW === 'CI';
const systemProductionOrigin = vercelProductionUrl
  ? /^https?:\/\//u.test(vercelProductionUrl)
    ? vercelProductionUrl
    : `https://${vercelProductionUrl}`
  : '';
const raw = configured || systemProductionOrigin || (isCanonicalCi ? 'https://canonical.test' : '');

if (!raw) {
  throw new Error(
    'VITE_SITE_URL or VERCEL_PROJECT_PRODUCTION_URL is required for canonical origin validation.',
  );
}

if (!configured) {
  process.env.VITE_SITE_URL = raw;
}

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);
