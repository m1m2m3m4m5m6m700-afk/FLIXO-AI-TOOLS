import { execFileSync } from 'node:child_process';
import { getCanonicalSiteOrigin } from '../src/config/origin.config.ts';

const OFFICIAL_PRODUCTION_ORIGIN = 'https://flixoai.vercel.app';
const configured = process.env.VITE_SITE_URL?.trim();
const isVercelBuild = process.env.VERCEL === '1';
const isCanonicalCi =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_WORKFLOW === 'CI';
const raw = configured || (isVercelBuild || isCanonicalCi ? OFFICIAL_PRODUCTION_ORIGIN : '');

if (!raw) {
  throw new Error(
    'VITE_SITE_URL is required outside Vercel/CI. Configure SITE_URL/VITE_SITE_URL with the official production origin.',
  );
}

if (!configured) {
  process.env.VITE_SITE_URL = raw;
}

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);

if (process.env.GITHUB_ACTIONS === 'true' && process.env.S3_BASE_REF) {
  const base = process.env.S3_BASE_REF;
  try {
    execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { stdio: 'ignore' });
  } catch {
    if (base === 'origin/main') {
      execFileSync(
        'git',
        ['fetch', '--no-tags', '--depth=1', 'origin', 'main:refs/remotes/origin/main'],
        { stdio: 'inherit' },
      );
      execFileSync('git', ['rev-parse', '--verify', 'origin/main^{commit}'], { stdio: 'ignore' });
      console.log('S3 BASE REF READY: origin/main');
    } else {
      throw new Error(`S3 base ref is unavailable: ${base}`);
    }
  }
}
