import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const browsers = ['chromium', 'firefox', 'webkit'];
const tools = [
  'image-compressor','background-remover','image-upscaler','image-converter','ai-image-generator',
  'object-remover','watermark-remover','image-cropper','image-to-svg','image-ocr','photo-colorizer',
  'background-blur','passport-photo-maker','watermark-adder','meme-generator','collage-maker','image-effects',
  'exif-cleaner','svg-optimizer','mockup-generator','seed','pix','localization'
];

const historyPath = process.env.CI_DURATION_HISTORY || 'diagnostics/ci-duration-history.json';
const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, 'utf8')) : {};
const configured = Number.parseInt(process.env.CI_MAX_PARALLEL || '12', 10);
const maxParallel = Number.isFinite(configured) && configured > 0 ? Math.min(configured, tools.length * browsers.length) : 12;

const units = [];
for (const browser of browsers) {
  for (const tool of tools) {
    const spec = tool === 'localization' ? 'tests/localization-smoke.spec.ts' : `tests/${tool}.spec.ts`;
    const weight = Number(history[`${tool}:${browser}`] ?? history[tool] ?? 1);
    units.push({ tool, browser, spec, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 });
  }
}

// Greedy LPT (largest-processing-time first): deterministic weighted balancing.
units.sort((a, b) => b.weight - a.weight || a.tool.localeCompare(b.tool) || a.browser.localeCompare(b.browser));
const shardCount = Math.min(maxParallel, units.length);
const shards = Array.from({ length: shardCount }, (_, index) => ({ id: index + 1, load: 0, units: [] }));
for (const unit of units) {
  shards.sort((a, b) => a.load - b.load || a.id - b.id);
  shards[0].units.push(unit);
  shards[0].load += unit.weight;
}
shards.sort((a, b) => a.id - b.id);

const matrix = shards.flatMap((shard) => shard.units.map((unit) => ({ ...unit, shard: shard.id })));
const result = { version: 1, generatedAt: new Date().toISOString(), maxParallel, shardCount, units: matrix, shards };
writeFileSync('diagnostics/ci-shard-plan.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
