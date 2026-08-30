import { spawnSync } from 'node:child_process';

const commands = [
  ['quickflow', 'npm', ['run', 'test:quickflow']],
  ['ai-planner', 'npm', ['run', 'test:ai-planner']],
  ['route-resolver', 'npm', ['run', 'test:route-resolver']],
  ['upload-boundary', 'npm', ['run', 'test:upload-boundary']],
  ['tool-localization', 'npm', ['run', 'test:tool-localization']],
  ['release-evidence', 'node', ['scripts/test-release-evidence.mjs']],
  ['file-safety', 'node', ['--experimental-strip-types', 'scripts/test-file-safety.mjs']],
  ['output-integrity', 'node', ['--experimental-strip-types', 'scripts/test-output-integrity.mjs']],
  ['svg-integrity', 'node', ['--experimental-strip-types', 'scripts/test-svg-integrity.mjs']],
  ['engineering-baseline', 'npm', ['run', 'validate:baseline']],
  ['tool-registry', 'npm', ['run', 'validate:tool-registry']],
  ['tool-manifest', 'npm', ['run', 'validate:tool-manifest']],
  ['router-registry', 'npm', ['run', 'validate:router-registry']],
  ['ci-contract', 'npm', ['run', 'validate:ci-contract']],
  ['ci-artifact-contract', 'node', ['scripts/validate-ci-artifact-contract.mjs']],
];

for (const [name, command, args] of commands) {
  console.log(`\n===== CORE CONTRACT: ${name} =====`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(`${name} failed to start:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${name} failed with exit code ${result.status ?? 'unknown'}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nCore contract suite passed: ${commands.length} unique contract groups.`);
