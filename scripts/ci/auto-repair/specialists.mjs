const specialists = Object.freeze({
  lint: { id: 'eslint-specialist', confidence: 92, safe: true },
  typescript: { id: 'typescript-specialist', confidence: 86, safe: false },
  playwright: { id: 'playwright-specialist', confidence: 72, safe: false },
  webkit: { id: 'webkit-specialist', confidence: 70, safe: false },
  certification: { id: 'certification-specialist', confidence: 70, safe: false },
  build: { id: 'build-specialist', confidence: 82, safe: false },
});

export function selectSpecialist(features) {
  return [...features].map((feature) => specialists[feature]).filter(Boolean).sort((a, b) => b.confidence - a.confidence)[0] ?? null;
}

export function specialistCatalog() { return specialists; }
