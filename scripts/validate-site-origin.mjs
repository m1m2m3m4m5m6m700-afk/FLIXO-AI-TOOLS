import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const configured = process.env.VITE_SITE_URL?.trim();
const isCanonicalCi =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_WORKFLOW === 'CI';
const raw = configured || (isCanonicalCi ? 'https://canonical.test' : '');

if (!raw) {
  throw new Error(
    'VITE_SITE_URL is required for production canonical origin validation. Configure the repository SITE_URL variable.',
  );
}

if (!configured && isCanonicalCi) {
  process.env.VITE_SITE_URL = raw;
}

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);
