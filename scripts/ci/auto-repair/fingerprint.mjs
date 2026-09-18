import crypto from 'node:crypto';

export function normalizeFailure(text) {
  return text
    .replace(/\b\d{8,}\b/g, '<RUN>')
    .replace(/[0-9a-f]{40}/gi, '<SHA>')
    .replace(/\b\d+\.\d+\.\d+\b/g, '<VERSION>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<TIME>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export function fingerprintFailure(text) {
  const normalized = normalizeFailure(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function extractFeatures(text) {
  const features = [];
  const checks = [
    ['external-tooling', /SessionModelError|CAPIError|requested model is not supported|github-advanced-security\[bot\]|code scanning AI findings/i],
    ['lint', /eslint|no-unused-vars|defined but never used/i],
    ['format', /prettier|formatting|code style/i],
    ['typescript', /TS\d+|Type error|typescript/i],
    ['playwright', /playwright|expect\(|locator\(|page\./i],
    ['webkit', /webkit|data-render-revision|GPU rendering|waitForGpuRender/i],
    ['certification', /certification|execution graph|FAST.*66|DEEP.*60/i],
    ['build', /vite build|production build|build failed/i],
  ];
  for (const [id, pattern] of checks) if (pattern.test(text)) features.push(id);
  return features;
}
