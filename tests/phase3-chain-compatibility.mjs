import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/tool-chain-compatibility.ts', import.meta.url), 'utf8');

assert.match(source, /TOOL_CHAIN_CONTRACTS/);
assert.match(source, /image-converter/);
assert.match(source, /image-upscaler/);
assert.match(source, /background-remover/);
assert.match(source, /validateToolChain/);
assert.match(source, /cannot accept/);

console.log('phase3 chain compatibility contract: ok');
