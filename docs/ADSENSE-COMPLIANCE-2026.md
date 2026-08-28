# FLIXO AdSense / Google Publisher Compliance Architecture

This document separates Google requirements from FLIXO internal hardening so the project does not mistake local engineering thresholds for Google policy.

## Google-aligned blocking principles

1. Ads must not be implemented so users can mistake them for navigation, download controls, menus, or other site UI. Avoid placements likely to cause accidental clicks, especially around download controls and heavy-interaction elements.
2. Do not serve Google ads on screens without meaningful publisher content, low-value screens, construction or placeholder screens, or navigation/alert surfaces.
3. Do not allow advertising or paid promotional material to overwhelm publisher content.
4. Do not encourage clicks, manufacture traffic, buy low-quality traffic, or deploy implementations that create invalid traffic.
5. For personalized ads in the EEA, UK, and Switzerland, use a Google-certified CMP integrated with the IAB Transparency & Consent Framework (TCF).
6. FLIXO targets the current TCF v2.3 production model; no internal CMP shim is treated as proof of Google certification.
7. Avoid scaled, unoriginal, low-value pages. Search considers mass-generated pages created primarily to manipulate rankings and provide little value to users to be scaled content abuse, regardless of whether automation or AI was used.
8. Software/application structured data is optional Search markup. It must accurately describe the page and is not an AdSense approval signal.
9. Core Web Vitals should be monitored against real-user 75th-percentile targets: LCP 2.5s or better, INP 200ms or better, CLS 0.1 or better.

## FLIXO internal hardening

- Minimum 25px separation around ad containers and high-interaction controls.
- Reserved ad-slot height to reduce layout movement.
- Localized `Advertisements` labels for all 20 locales.
- Hard-blocked ad surfaces: error, empty, modal, loader, and internal application flows.
- One central AdSense runtime boundary; raw AdSense implementation is forbidden elsewhere.
- Ads are fail-closed until the publisher ID, certified CMP configuration, and required consent are available.
- A substantive-content floor is a FLIXO engineering heuristic, not a Google word-count rule.
- Exact 300–500-word quotas, exact 70% viewport-content ratios, and universal 25px rules are not represented as Google mandates.

## Crawler-first publishing architecture

FLIXO is a Vite + React + TanStack Router application. The production build therefore emits a crawler-first HTML representation for every ready tool route from the canonical `TOOL_SEO_MANIFESTS` source of truth.

Every prerendered tool page contains localized HTML language/direction, canonical URL, reciprocal hreflang plus x-default, robots directives, a visible H1, substantive description and introduction, workflow steps, feature information, quality guidance, related-tool links, and structured data.

The SPA JavaScript entrypoint is retained so hydration can take over after the initial HTML is served. The release gate verifies the generated files rather than assuming that client-side rendering succeeded.

## Consent architecture

`src/adsense/policy.ts` is the single policy source.

`src/adsense/AdSlot.tsx` is the only approved AdSense rendering boundary.

Production ad serving requires:

- `VITE_ADSENSE_PUBLISHER_ID`;
- the actual production `VITE_TCF_CMP_ID`;
- `VITE_TCF_CMP_CERTIFIED=true` only after that CMP is actually verified against Google's certified CMP requirements;
- TCF Purpose 1 consent before the Google ad tag is called.

No fake CMP ID, fake publisher ID, or fabricated certification state is stored in the repository. Without the production configuration, AdSense remains disabled.

## Legal surfaces

Production routes `/privacy`, `/terms`, and `/cookies` are wired into the route graph. They explain local browser processing, consent storage, and the possibility of Google advertising technology when advertising is enabled.

These are engineering surfaces rather than legal advice. Final production text must be reviewed for the actual operator, vendors, jurisdictions, retention periods, rights language, and contact details.

## Indexing and discovery release gate

Before an indexed production release, the system should satisfy all of the following:

- canonical URLs resolve to a single preferred URL for each page;
- localized versions use consistent language URLs and reciprocal hreflang;
- the sitemap contains only intended indexable URLs and matches the canonical route graph;
- robots directives do not accidentally exclude intended public content;
- important pages are reachable through normal HTML links, not only client-side controls;
- the initial HTML contains the useful page content rather than an empty application shell;
- structured data describes the actual visible page content;
- localized text is genuinely useful for that locale and not merely machine-expanded template padding;
- pages provide distinct task guidance, limitations, expected inputs/outputs, and related navigation where appropriate;
- invalid, incomplete, error, modal, loading, and private application surfaces remain out of the indexable monetization path.

The automated gates prove architecture and artifact consistency. They cannot prove human editorial quality or guarantee indexing.

## Release gate

Before monetization is enabled in production, the release must have:

- passing AdSense readiness audit;
- no raw AdSense implementation outside the central boundary;
- all 20 locale ad labels present;
- no blocked-surface placement;
- no obvious thin or duplicate localized SEO content;
- a real Google-certified CMP verified for the production consent implementation and applicable regions;
- verified prerender coverage for every ready indexed tool route;
- sitemap/canonical/hreflang symmetry;
- Privacy, Terms, and Cookie routes verified in the actual route graph;
- real-user Core Web Vitals monitoring after launch;
- `ads.txt` and publisher configuration verified in production;
- Google Search Console and AdSense Policy Center monitored after rollout.

This engineering gate substantially reduces implementation risk, but it cannot guarantee Google account approval, indexing, ranking position, or future policy decisions.
