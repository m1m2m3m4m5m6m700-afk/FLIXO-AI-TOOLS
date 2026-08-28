# FLIXO AdSense / Google Publisher Compliance Architecture

This document separates **Google requirements** from **FLIXO internal hardening** so the project does not mistake local engineering thresholds for Google policy.

## Google-aligned blocking principles

1. Ads must never be implemented so users can mistake them for navigation, download controls, menus, or other site UI. Google explicitly warns against placements that can cause accidental clicks, especially near download buttons and heavy-interaction elements. citeturn518423search0turn236219search2
2. Do not serve Google ads on screens without meaningful publisher content, low-value screens, construction/placeholder screens, or screens used for navigation/alerts. citeturn236219search5
3. Do not allow advertising or paid promotional material to exceed publisher content. citeturn518423search6
4. Do not encourage clicks, manufacture traffic, buy low-quality traffic, or deploy implementations that create invalid traffic. Google monitors clicks/impressions and publishers are responsible for traffic quality. citeturn236219search0turn236219search2
5. For personalized ads in the EEA, UK, and Switzerland, use a Google-certified CMP integrated with the IAB TCF. citeturn518423search3turn518423search5
6. Avoid scaled, unoriginal, low-value content. Google Search considers mass-generated pages made primarily to manipulate rankings and provide little value to be scaled content abuse, including AI-generated pages without added value. citeturn518423search1
7. Software/application structured data is a Search feature, not an AdSense policy requirement. Use it only where the page actually represents a software application and it follows Google's structured-data guidelines. citeturn518423search2
8. Core Web Vitals targets are measured at real-world 75th percentile: LCP <2.5s, INP <200ms, CLS <0.1. citeturn132075search0

## FLIXO internal hardening

- Minimum 25px separation around ad containers and high-interaction controls.
- A reserved ad slot height to reduce layout movement.
- Localized `Advertisements` labels for all 20 locales.
- Hard-blocked ad surfaces: error, empty, modal, loader, and internal application flows.
- One central AdSense runtime boundary; raw AdSense code is forbidden elsewhere.
- Ads are fail-closed until both the publisher ID and TCF consent are available.
- A substantive-content floor of 140 words is a **FLIXO engineering heuristic**, not a Google word-count rule.
- Exact 300–500-word quotas, an exact 70% viewport-content ratio, and a universal 25px Google requirement are intentionally **not** represented as Google mandates because Google does not publish those figures as universal AdSense policy.

## Runtime architecture

FLIXO is a Vite + React + TanStack Router application, so the implementation uses a singleton DOM script loader and a React `AdSlot`, not `next/script`.

`src/adsense/policy.ts` is the single policy source.

`src/adsense/AdSlot.tsx` is the only approved AdSense rendering boundary.

`scripts/validate-adsense-readiness.mjs` is the blocking static audit.

### Fail-closed rule

Without `VITE_ADSENSE_PUBLISHER_ID`, no AdSense request is made. Even with a publisher ID, the slot stays disabled until TCF consent is available. This prevents accidental live serving during development or incomplete consent/legal deployment.

## Release gate

Before monetization is enabled in production, the release must have:

- passing AdSense readiness audit;
- no raw AdSense implementation outside the central boundary;
- all 20 locale ad labels present;
- no blocked-surface placement;
- no obvious thin/duplicate localized SEO content;
- a certified CMP verified for the actual production consent mode and regions;
- localized Privacy, Terms and Cookie routes verified in the actual route graph;
- Core Web Vitals monitored with real-user data after launch;
- `ads.txt` and publisher configuration verified in production;
- Google Search Console and AdSense Policy Center monitored after rollout.

This engineering gate can substantially reduce risk, but it cannot guarantee Google account approval or override Google's policy decisions, reviews, or future policy updates.
