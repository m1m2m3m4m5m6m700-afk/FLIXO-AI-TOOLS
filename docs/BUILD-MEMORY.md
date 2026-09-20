# Build Memory

## B03-CD-production-origin-unification
- Base SHA: `67240cadc6d4ec27d7d82e2b8f2ba975641503b6`
- Target: align CD production identity proof with canonical origin `https://flixoai.vercel.app`.
- Change: `.github/workflows/cd.yml`.
- Expected effect: production identity proof validates the same production origin used by canonical CI/site configuration.
