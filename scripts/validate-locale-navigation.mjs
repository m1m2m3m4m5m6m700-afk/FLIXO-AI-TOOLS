import { readFileSync } from 'node:fs';

const config = readFileSync('src/lib/i18n/config.ts', 'utf8');
const home = readFileSync('src/routes/home-page.tsx', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

const locales = config.match(/export const LOCALES = \[([\s\S]*?)\] as const/)?.[1]?.match(/'([a-z]{2})'/g)?.map((value) => value.slice(1, -1)) ?? [];

if (locales.length !== 20) {
  throw new Error(`Expected 20 canonical locales, found ${locales.length}`);
}

if (home.includes('window.location.assign(`/${event.target.value}`)')) {
  throw new Error('Locale selector must use client-side router navigation, not a full document navigation.');
}

if (!home.includes('useNavigate') || !home.includes('navigate({ to: `/${event.target.value}` })')) {
  throw new Error('Home locale selector is missing TanStack Router client-side navigation.');
}

const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
const localeRewrites = new Set();
for (const rewrite of rewrites) {
  const match = /^\/([a-z]{2})\/:path\*$/.exec(rewrite.source ?? '');
  if (match && rewrite.destination === '/') localeRewrites.add(match[1]);
}

const hasCompleteRewriteFallback = locales.every((locale) => localeRewrites.has(locale));
const buildCommand = String(vercel.buildCommand ?? '');
const hasStaticRouteGeneration = buildCommand.includes('scripts/generate-static-route-entries.mjs');

if (!hasCompleteRewriteFallback && !hasStaticRouteGeneration) {
  const missingRewrites = locales.filter((locale) => !localeRewrites.has(locale));
  throw new Error(`Locale navigation has neither complete SPA fallback rewrites nor the canonical static route generator. Missing rewrites: ${missingRewrites.join(', ')}`);
}

const routingMode = hasCompleteRewriteFallback ? 'rewrite fallback' : 'canonical static route generation';
console.log(`Locale navigation validation passed: ${locales.length} locales use client-side navigation with ${routingMode}.`);
