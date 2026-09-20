import assert from 'node:assert/strict';

const canonical = await import('../api/admin/canonical.ts');

const input = { b: 1, a: { d: 2, c: [{ z: 3, a: 4 }] } };
const reordered = { a: { c: [{ a: 4, z: 3 }], d: 2 }, b: 1 };
const expected = 'b6ffe1d6ed9e3fac2777eb244a6b657d4df0843f578e30ea6bc89429936bc7cd';

assert.deepEqual(canonical.canonicalize(input), reordered);
assert.equal(canonical.integritySha256(input), expected);
assert.equal(canonical.integritySha256(reordered), expected);
assert.equal(canonical.canonicalTimestamp('2026-09-15T00:00:00+00:00'), '2026-09-15T00:00:00.000Z');
assert.equal(canonical.canonicalTimestamp(null), null);

console.log('ADMIN canonical persistence contract: PASS');
