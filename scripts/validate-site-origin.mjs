import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const raw = process.env.VITE_SITE_URL?.trim();
if (!raw) {
  throw new Error('VITE_SITE_URL is required for production canonical origin validation. Configure the repository SITE_URL variable.');
}

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);
