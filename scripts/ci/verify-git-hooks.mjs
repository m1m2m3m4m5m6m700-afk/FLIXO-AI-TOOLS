import { access, constants } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const hooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim();
if (hooksPath !== '.githooks') throw new Error(`Expected core.hooksPath=.githooks, got ${hooksPath || '<unset>'}`);
for (const hook of ['pre-commit', 'pre-push']) {
  const file = resolve(root, '.githooks', hook);
  await access(file, constants.X_OK);
}
console.log('FLIXO Git hooks verification PASS: core.hooksPath=.githooks and both hooks are executable.');
