import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildErrorOnlyRepairModel, classifyRepairTarget } from './error-only-programmer.mjs';
import { runAstRepair } from './ast-repair.mjs';

const sha = 'a'.repeat(40);

const valid = buildErrorOnlyRepairModel({
  log: 'ERROR eslint: no-unused-vars at src/example.ts:10:2',
  diagnosis: {
    rootCause: 'lint',
    decision: 'ALLOW_BOUNDED_MUTATION',
    sourceMutationAllowed: true,
    directFailureSignal: true,
    causalConfidence: 0.92,
    location: { file: 'src/example.ts' },
  },
  selected: { id: 'eslint-unused', file: 'src/example.ts' },
  targetSha: sha,
});
assert.equal(valid.authority, 'ERROR_ONLY_PROGRAMMER_MODEL');
assert.equal(valid.mode, 'SOURCE_ERROR_REPAIR_ONLY');
assert.equal(valid.repair.mutationAllowed, true);
assert.equal(valid.repair.driver, 'eslint-ast');

for (const selected of [
  { id: 'eslint-unused', file: 'tests/example.spec.ts' },
  { id: 'eslint-unused', file: 'scripts/ci/repair-protocol.mjs' },
  { id: 'unsupported', file: 'src/example.ts' },
]) {
  assert.equal(classifyRepairTarget({
    diagnosis: { rootCause: 'lint', decision: 'ALLOW_BOUNDED_MUTATION', sourceMutationAllowed: true, directFailureSignal: true, causalConfidence: 0.95, ambiguity: false, location: { file: selected.file } },
    selected,
  }).allowed, false);
}

const lowConfidence = buildErrorOnlyRepairModel({
  log: 'ERROR eslint: no-unused-vars at src/example.ts:10:2',
  diagnosis: {
    rootCause: 'lint', decision: 'ALLOW_BOUNDED_MUTATION', sourceMutationAllowed: true,
    directFailureSignal: true, causalConfidence: 0.60, location: { file: 'src/example.ts' },
  },
  selected: { id: 'eslint-unused', file: 'src/example.ts' },
  targetSha: sha,
});
assert.equal(lowConfidence.repair.mutationAllowed, false);
assert(lowConfidence.blockedReasons.includes('ERROR_CAUSAL_CONFIDENCE_TOO_LOW'));

const external = buildErrorOnlyRepairModel({
  log: 'CAPIError: requested model is not supported',
  diagnosis: { rootCause: 'external-tooling', decision: 'BLOCK_EXTERNAL', sourceMutationAllowed: false, directFailureSignal: true, causalConfidence: 0.99 },
  selected: { id: 'external-tooling' },
  targetSha: sha,
});
assert.equal(external.failClosed, true);
assert(external.blockedReasons.includes('ERROR_EXTERNAL_BLOCKER_IS_NOT_SOURCE_DEFECT'));

const multi = classifyRepairTarget({
  diagnosis: { location: { file: 'src/a.ts' } },
  selected: { id: 'prepared-source-change', files: ['src/a.ts', 'src/b.ts'] },
});
assert.equal(multi.allowed, true);
assert.deepEqual(multi.targetFiles, ['src/a.ts', 'src/b.ts']);

console.log('ERROR_ONLY_PROGRAMMER_MODEL_CONTRACT=PASS');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-ts-driver-test-'));
try {
  fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'src', 'provider.ts'), 'export class Widget {}\\n');
  fs.writeFileSync(path.join(temp, 'src', 'app.ts'), 'export const value: Widget | null = null;\\n');
  execFileSync('git', ['-C', temp, 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', temp, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', temp, 'config', 'user.name', 'FLIXO Test']);
  execFileSync('git', ['-C', temp, 'add', 'src']);
  execFileSync('git', ['-C', temp, 'commit', '-m', 'fixture'], { stdio: 'ignore' });
  const repair = runAstRepair(temp, { id: 'typescript-missing-import', file: 'src/app.ts', symbol: 'Widget' });
  assert.equal(repair.applied, true);
  assert.equal(repair.moduleFile, 'src/provider.ts');
  assert.match(fs.readFileSync(path.join(temp, 'src', 'app.ts'), 'utf8'), /import \\{ Widget \\} from '\\.\\/provider';/u);
  console.log('TYPESCRIPT_MISSING_IMPORT_EXECUTOR_TEST=PASS');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
