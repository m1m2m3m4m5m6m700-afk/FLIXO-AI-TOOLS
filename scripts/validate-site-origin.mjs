import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const configured = process.env.VITE_SITE_URL?.trim();
const isVercelProduction = process.env.VERCEL_ENV === 'production';
const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
const isCanonicalCi =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_WORKFLOW === 'CI';
const systemProductionOrigin =
  isVercelProduction && vercelProductionUrl
    ? /^https?:\/\//u.test(vercelProductionUrl)
      ? vercelProductionUrl
      : `https://${vercelProductionUrl}`
    : '';
const raw = configured || systemProductionOrigin || (isCanonicalCi ? 'https://canonical.test' : '');

if (!raw) {
  throw new Error(
    'VITE_SITE_URL is required for production canonical origin validation outside supported production system configuration. Configure the repository SITE_URL variable.',
  );
}

if (!configured) {
  process.env.VITE_SITE_URL = raw;
}

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);
