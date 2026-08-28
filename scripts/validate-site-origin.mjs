import { getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';

const origin = getCanonicalSiteOrigin();
console.log(`SITE_ORIGIN CONTRACT PASS: ${origin}`);
