import assert from 'node:assert/strict';

const source = await (await fetch('https://raw.githubusercontent.com/m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS/main/src/lib/tool-chain-compatibility.ts')).text();

assert.match(source, /TOOL_CHAIN_CONTRACTS/);
assert.match(source, /image-converter/);
assert.match(source, /image-upscaler/);
assert.match(source, /background-remover/);
assert.match(source, /validateToolChain/);
assert.match(source, /cannot accept/);

console.log('phase3 chain compatibility contract: ok');
