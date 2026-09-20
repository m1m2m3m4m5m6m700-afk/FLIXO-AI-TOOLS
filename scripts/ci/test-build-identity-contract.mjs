import { readFileSync } from 'node:fs';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const cd = readFileSync('.github/workflows/cd.yml', 'utf8');
const producer = readFileSync('scripts/ci/runtime/build-identity.mjs', 'utf8');
const failures = [];

const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) failures.push(message);
};

requireMatch(
  ci,
  /name:\s*Create canonical build artifact identity[\s\S]{0,300}node scripts\/ci\/runtime\/build-identity\.mjs/,
  'CI must invoke the canonical build identity producer after the build.',
);
requireMatch(
  ci,
  /test -s dist\/__flixo\/build-identity\.json[\s\S]{0,500}\.producer.*build-identity\.mjs/s,
  'CI must validate the producer-owned identity manifest.',
);
requireMatch(
  ci,
  /name:\s*flixo-build-\$\{\{ github\.run_id \}\}[\s\S]{0,180}path:\s*dist\//,
  'CI must publish the producer output inside the immutable build artifact.',
);
requireMatch(
  cd,
  /gh run download[\s\S]{0,300}\/tmp\/artifact\/__flixo\/build-identity\.json[\s\S]{0,600}\.commitSha.*PROMOTION_SHA/s,
  'CD must consume and verify the canonical identity manifest before deployment.',
);
requireMatch(
  producer,
  /producer:\s*'scripts\/ci\/runtime\/build-identity\.mjs'/,
  'The identity manifest must identify its authoritative producer.',
);
requireMatch(
  producer,
  /schemaVersion:\s*2/,
  'The canonical identity schema version must be explicit.',
);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('BUILD_IDENTITY_CONTRACT=PASS');
console.log('AUTHORITATIVE_PRODUCER=scripts/ci/runtime/build-identity.mjs');
console.log('AUTHORITATIVE_CONSUMER=.github/workflows/cd.yml');
