import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = (process.env.FLIXO_PRODUCTION_ORIGIN || 'https://flixoai.vercel.app').replace(/\/$/, '');
const expectedSha = process.env.EXPECTED_SHA?.trim() || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

assert.match(expectedSha, /^[0-9a-f]{40}$/, 'EXPECTED_SHA must be a 40-character lowercase Git SHA');

async function read(path) {
  const response = await fetch(`${origin}${path}`, {
    headers: { accept: path.endsWith('.txt') ? 'text/plain' : 'text/html' },
    redirect: 'error',
  });
  const body = await response.text();
  assert.equal(response.status, 200, `${path}: expected HTTP 200, got ${response.status}`);
  return body;
}

const shaBody = (await read('/flixo-head-sha.txt')).trim();
assert.equal(shaBody, expectedSha, `production SHA mismatch: expected ${expectedSha}, got ${shaBody || '<empty>'}`);

const html = await read('/');
assert.match(html, /<html[\s>]/i, 'production root must return HTML');
assert.match(html, /FLIXO|flixo/i, 'production root HTML must identify the FLIXO application');

console.log(`ADMIN production exact-SHA read-back: PASS (${expectedSha})`);
