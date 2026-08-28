# FLIXO Production Monetization Gate

Monetization is a release capability, not a development default. The application stays fail-closed until every production dependency below is verified.

## Required before serving Google ads

1. Use a real Google AdSense publisher ID configured only in the production environment.
2. For EEA, UK, and Switzerland traffic where the Google consent requirements apply, use a Google-certified CMP integrated with the IAB Europe TCF. The current TCF target is v2.3.
3. Verify the production CMP emits a valid TC string before the Google ad tag is requested and that withdrawal of consent stops further ad rendering.
4. Publish a valid production `ads.txt` record matching the actual publisher ID and approved seller relationship.
5. Keep all Google ad rendering behind `src/adsense/AdSlot.tsx`; do not add raw ad snippets elsewhere.
6. Keep ads off error, empty, modal, loader, internal, or otherwise blocked interaction surfaces.
7. Verify localized privacy/cookie disclosures and the production consent experience for every applicable market.
8. Verify that each monetized page contains meaningful publisher content and that advertising does not overwhelm that content.

## Environment contract

Required for production enablement:

- `VITE_ADSENSE_PUBLISHER_ID`
- `VITE_TCF_CMP_ID`
- `VITE_TCF_CMP_CERTIFIED=true`

No development or CI job should invent values for these variables.

## What CI can prove

CI can prove code structure, fail-closed behavior, manifest coverage, locale coverage, prerender coverage, legal route wiring, `ads.txt` syntax, and content duplication signals.

## What CI cannot prove

CI cannot prove Google's account approval, a CMP's current certification status, legal compliance in every jurisdiction, or the long-term quality judgment of Google Search systems. Those require production verification and ongoing human review.
