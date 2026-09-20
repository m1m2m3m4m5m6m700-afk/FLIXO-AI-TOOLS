import fs from 'node:fs';

const source = fs.readFileSync('src/lib/tool-chain-adapters.ts', 'utf8');
const required = [
  "'image-converter'",
  "'image-upscaler'",
  "'background-remover'",
  'getToolChainAdapter',
  'executeToolChain',
  'no local chain adapter yet',
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing adapter contract token: ${token}`);
}
if (!source.includes("convertImage(blob, 'image/webp')")) throw new Error('Image converter adapter must default to WebP.');
if (!source.includes('resizeImage(blob, 2)')) throw new Error('Image upscaler adapter must use a deterministic 2x scale.');
if (!source.includes('removeBackground(blob, 42)')) throw new Error('Background remover adapter must use a deterministic local tolerance.');
console.log('phase3-tool-adapters-contract: PASS');
