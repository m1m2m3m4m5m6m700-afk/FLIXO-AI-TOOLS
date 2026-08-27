import { readFileSync } from 'node:fs';

const componentPath = 'src/components/canvas/ZenCanvas.tsx';
const source = readFileSync(componentPath, 'utf8');

const requiredTokens = [
  'backdrop-blur-md',
  'border-white/10',
  'aria-expanded',
  'aria-controls',
  'showAdvanced',
  'ref={ref}',
  'useId',
];

for (const token of requiredTokens) {
  if (!source.includes(token)) {
    throw new Error(`S2D_UX_VIOLATION: missing required token ${token}`);
  }
}

const primaryCtaMatches = source.match(/data-primary-cta="true"/g) ?? [];
if (primaryCtaMatches.length !== 1) {
  throw new Error(`S2D_CTA_VIOLATION: expected exactly 1 primary CTA, found ${primaryCtaMatches.length}`);
}

console.log('S2D_CANVAS_UX_GATE_PASSED');
