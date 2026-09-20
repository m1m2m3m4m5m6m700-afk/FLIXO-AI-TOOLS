import assert from 'node:assert/strict';
import { LIVE_FILTER_REGISTRY, getLiveFilter } from '../src/tools/filter-mask/registry.ts';
assert.ok(LIVE_FILTER_REGISTRY.length >= 60);
assert.equal(new Set(LIVE_FILTER_REGISTRY.map((filter) => filter.canonicalId)).size, LIVE_FILTER_REGISTRY.length);
assert.ok(LIVE_FILTER_REGISTRY.every((filter) => filter.version === 1 && filter.supportsLive));
assert.equal(getLiveFilter('effect.original')?.canonicalId, 'effect.original');
assert.equal(getLiveFilter('missing'), undefined);
console.log('Filter Mask registry contract: PASS');
