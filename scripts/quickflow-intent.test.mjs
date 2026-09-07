import assert from 'node:assert/strict';

const { resolveIntent } = await import('../src/lib/intent/resolver.ts');

const product = resolveIntent('I need a product photo ready for Amazon');
assert.equal(product.kind, 'workflow');
assert.equal(product.id, 'product-ready');

const arabic = resolveIntent('عايز صورة منتج جاهزة للمتجر');
assert.equal(arabic.kind, 'workflow');
assert.equal(arabic.id, 'product-ready');

const tool = resolveIntent('remove background and make it transparent');
assert.equal(tool.kind, 'tool');
assert.equal(tool.id, 'background-remover');

const none = resolveIntent('hello there');
assert.equal(none.kind, 'none');
assert.equal(none.id, null);

console.log('QuickFlow deterministic intent contracts: PASS');
