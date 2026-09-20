import { spawnSync } from 'node:child_process';

const targets = ['tsconfck', '@esbuild-kit/core-utils', '@esbuild-kit/esm-loader'];

const result = spawnSync('npm', ['ls', ...targets, '--all', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.error) {
  throw new Error(`Failed to run npm ls: ${result.error.message}`, { cause: result.error });
}

const stdout = (result.stdout ?? '').trim();
if (!stdout) {
  const stderr = (result.stderr ?? '').trim();
  throw new Error(
    `npm ls produced no JSON (exit ${result.status}): ${stderr || 'no stderr output'}`,
  );
}

let tree;
try {
  tree = JSON.parse(stdout);
} catch (error) {
  throw new Error(
    `Failed to parse npm ls output (exit ${result.status}): ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}

console.log('Dependency trace inventory');
console.log(`npm ls exit: ${result.status ?? 'unknown'}`);

for (const target of targets) {
  const matches = [];
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (node.dependencies?.[target]) {
      const dependency = node.dependencies[target];
      matches.push({
        parent: path,
        version: dependency.version ?? null,
        resolved: dependency.resolved ?? null,
        invalid: Boolean(dependency.invalid),
        extraneous: Boolean(dependency.extraneous),
      });
    }
    for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
      visit(dependency, `${path} > ${name}`);
    }
  };

  visit(tree, tree.name ?? 'root');
  console.log(`\n${target}`);
  if (matches.length === 0) {
    console.log('  not present in dependency tree');
    continue;
  }

  for (const match of matches.sort((a, b) => a.parent.localeCompare(b.parent))) {
    console.log(
      `  parent=${match.parent} version=${match.version} invalid=${match.invalid} extraneous=${match.extraneous}`,
    );
  }
}

// Informational only. npm ls can exit non-zero for peer/dependency issues;
// blocking policy remains in npm ci and production audit gates.
process.exit(0);
