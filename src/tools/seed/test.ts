export const seedTestContract = Object.freeze({
  id: 'seed',
  route: '/en/seed',
  renderer: 'webgl',
  nonDestructive: true,
  directDownload: true,
  supportedAdjustments: ['brightness', 'contrast', 'saturation', 'warmth', 'ambiance', 'highlights', 'shadows'],
  expectedOutputType: 'image/png',
  invariants: [
    'Original source image is never mutated.',
    'WebGL rendering is optional and must fail with a visible error when unavailable.',
    'Export is generated from the rendered canvas and downloads directly in the browser.',
    'Undo/redo operates on SeedState snapshots rather than pixel buffers.',
  ],
});
