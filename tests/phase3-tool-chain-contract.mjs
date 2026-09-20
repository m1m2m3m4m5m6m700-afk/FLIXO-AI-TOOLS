import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile('src/components/tool-chain-panel.tsx', 'utf8');
const chain = await readFile('src/lib/tool-chain.ts', 'utf8');
const route = await readFile('src/routes/localized-tool-page.tsx', 'utf8');

assert.match(chain, /flixo:tool-chain:v1/);
assert.match(chain, /MAX_CHAIN_LENGTH = 8/);
assert.match(chain, /localStorage/);
assert.match(chain, /moveToolInChain/);
assert.match(panel, /Execution contract/);
assert.match(panel, /Add current tool/);
assert.match(route, /ToolChainPanel/);

console.log('phase3-tool-chain-contract: PASS');
