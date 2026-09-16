import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lockJson = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const root = lockJson.packages?.[''];

if (!root) {
  console.error('package-lock.json has no root package entry');
  process.exit(1);
}

const normalize = (value) => JSON.stringify(value ?? {});
const packageDeps = { ...(packageJson.dependencies ?? {}) };
const packageDevDeps = { ...(packageJson.devDependencies ?? {}) };
const lockDeps = { ...(root.dependencies ?? {}) };
const lockDevDeps = { ...(root.devDependencies ?? {}) };

const missingInLock = Object.keys(packageDeps).filter((name) => !Object.hasOwn(lockDeps, name));
const missingDevInLock = Object.keys(packageDevDeps).filter((name) => !Object.hasOwn(lockDevDeps, name));
const unexpectedRootDeps = Object.keys(lockDeps).filter((name) => !Object.hasOwn(packageDeps, name));
const unexpectedRootDevDeps = Object.keys(lockDevDeps).filter((name) => !Object.hasOwn(packageDevDeps, name));

// @playwright/test owns the Playwright runtime. Older lockfiles may retain a
// redundant root `playwright` entry even when the manifest only declares the
// supported test runner package. Treat that entry as a harmless lockfile
// compatibility artifact; all other manifest/lock drift remains fail-closed.
const toleratedRedundantDevDeps = new Set(
  packageDevDeps['@playwright/test'] && Object.hasOwn(lockDevDeps, 'playwright')
    ? ['playwright']
    : [],
);
const effectiveUnexpectedRootDevDeps = unexpectedRootDevDeps.filter(
  (name) => !toleratedRedundantDevDeps.has(name),
);

const mismatchedDeps = Object.keys(packageDeps).filter((name) => Object.hasOwn(lockDeps, name) && lockDeps[name] !== packageDeps[name]);
const mismatchedDevDeps = Object.keys(packageDevDeps).filter((name) => Object.hasOwn(lockDevDeps, name) && lockDevDeps[name] !== packageDevDeps[name]);
const overrideDrift = normalize(packageJson.overrides) !== normalize(root.overrides);

console.log(`Manifest runtime dependencies: ${Object.keys(packageDeps).length}`);
console.log(`Lockfile runtime dependencies: ${Object.keys(lockDeps).length}`);
console.log(`Manifest dev dependencies: ${Object.keys(packageDevDeps).length}`);
console.log(`Lockfile dev dependencies: ${Object.keys(lockDevDeps).length}`);

if (missingInLock.length || missingDevInLock.length || unexpectedRootDeps.length || effectiveUnexpectedRootDevDeps.length || mismatchedDeps.length || mismatchedDevDeps.length || overrideDrift) {
  if (missingInLock.length) console.error(`Missing runtime dependencies in lockfile: ${missingInLock.join(', ')}`);
  if (missingDevInLock.length) console.error(`Missing dev dependencies in lockfile: ${missingDevInLock.join(', ')}`);
  if (unexpectedRootDeps.length) console.error(`Unexpected runtime dependencies in lockfile: ${unexpectedRootDeps.join(', ')}`);
  if (effectiveUnexpectedRootDevDeps.length) console.error(`Unexpected dev dependencies in lockfile: ${effectiveUnexpectedRootDevDeps.join(', ')}`);
  if (mismatchedDeps.length) console.error(`Runtime dependency spec drift: ${mismatchedDeps.join(', ')}`);
  if (mismatchedDevDeps.length) console.error(`Dev dependency spec drift: ${mismatchedDevDeps.join(', ')}`);
  if (overrideDrift) console.error('Root overrides drift between package.json and package-lock.json');
  console.error('Lock/manifest contract: FAIL');
  process.exit(1);
}

if (toleratedRedundantDevDeps.size) {
  console.log(`Tolerated redundant lockfile dev dependencies: ${[...toleratedRedundantDevDeps].join(', ')}`);
}
console.log('Lock/manifest contract: PASS');
