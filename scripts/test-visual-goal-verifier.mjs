#!/usr/bin/env node
import assert from 'node:assert/strict';
import { assessVisualGoal, deriveVisualGoalSpec, visualChangeScore } from '../src/lib/agent/visual-goal-verifier.ts';

const raster = (width, height, value = 0) => ({ width, height, pixels: new Uint8Array(width * height * 4).fill(value) });
const base = raster(100, 50, 20);
const changed = raster(100, 50, 120);

assert.equal(deriveVisualGoalSpec('image-compressor').dimensions.kind, 'PRESERVE');
assert.deepEqual(deriveVisualGoalSpec('image-cropper', { width: 1200, height: 800 }).dimensions, { kind: 'EXACT', width: 1200, height: 800 });
assert.deepEqual(deriveVisualGoalSpec('image-upscaler', { scale: 2 }).dimensions, { kind: 'SCALE', scale: 2 });
assert.equal(deriveVisualGoalSpec('image-effects', { brightness: 100 }).requireVisibleChange, false);
assert.equal(deriveVisualGoalSpec('image-effects', { brightness: 130 }).requireVisibleChange, true);
assert.equal(visualChangeScore(base, raster(100, 50, 20)), 0);
assert.ok((visualChangeScore(base, changed) ?? 0) > 0.3);

const crop = assessVisualGoal(deriveVisualGoalSpec('image-cropper', { width: 40, height: 30 }), base, raster(40, 30, 20));
assert.equal(crop.verified, true);

const badUpscale = assessVisualGoal(deriveVisualGoalSpec('image-upscaler', { scale: 2 }), base, raster(150, 100, 20));
assert.equal(badUpscale.verified, false);
assert.match(badUpscale.reasons.join(','), /DIMENSIONS_MISMATCH/);

const effectNoOp = assessVisualGoal(deriveVisualGoalSpec('image-effects', { brightness: 130 }), base, raster(100, 50, 20));
assert.equal(effectNoOp.verified, false);
assert.match(effectNoOp.reasons.join(','), /NO_MEANINGFUL_CHANGE/);

const effectChanged = assessVisualGoal(deriveVisualGoalSpec('image-effects', { brightness: 130 }), base, changed);
assert.equal(effectChanged.verified, true);
assert.ok((effectChanged.visibleChangeScore ?? 0) > 0);

console.log('VISUAL_GOAL_VERIFIER_TEST=PASS');
