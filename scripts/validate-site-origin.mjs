import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const OFFICIAL_PRODUCTION_ORIGIN = 'https://flixoai.vercel.app';
const configured = process.env.VITE_SITE_URL?.trim();
const isVercelBuild = process.env.VERCEL === '1';
const isCanonicalCi =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_WORKFLOW === 'CI';
const raw = configured || (isVercelBuild ? OFFICIAL_PRODUCTION_ORIGIN : '') || (isCanonicalCi ? 'https://canonical.test' : '');

if (!raw) {
  throw new Error(
    'VITE_SITE_URL is required outside Vercel. Configure SITE_URL/VITE_SITE_URL with the official production origin.',
  );
}

if (!configured) {
  process.env.VITE_SITE_URL = raw;
}

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);
