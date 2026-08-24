import assert from 'node:assert/strict';

const source = await (await fetch('https://raw.githubusercontent.com/m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS/feat/phase3-runner/src/lib/tool-chain-runner.ts')).text();
assert.match(source, /runStoredToolChain/);
assert.match(source, /steps\.length === 0/);
assert.match(source, /executeToolChain\(\[toolId\], current\)/);
assert.match(source, /onStep\?/);
console.log('phase3-tool-chain-runner: PASS');
