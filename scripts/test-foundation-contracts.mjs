import assert from 'node:assert/strict';
import {
  normalizeThemePreference,
  resolveTheme,
} from '../src/lib/theme/persistent-theme.ts';
import { commitFiles } from '../src/lib/integrations/github/commits.ts';

assert.equal(normalizeThemePreference('dark'), 'dark');
assert.equal(normalizeThemePreference('light'), 'light');
assert.equal(normalizeThemePreference('invalid'), 'system');
assert.equal(resolveTheme('dark', false), 'dark');
assert.equal(resolveTheme('light', true), 'light');
assert.equal(resolveTheme('system', true), 'dark');
assert.equal(resolveTheme('system', false), 'light');

const calls = [];
const client = {
  async request(path, init = {}) {
    calls.push({ path, init });
    if (path.endsWith('/git/ref/heads/main')) return { object: { sha: 'parent-commit' } };
    if (path.endsWith('/git/commits/parent-commit')) return { tree: { sha: 'parent-tree' } };
    if (path.endsWith('/git/blobs')) return { sha: `blob-${calls.length}` };
    if (path.endsWith('/git/trees')) return { sha: 'new-tree' };
    if (path.endsWith('/git/commits')) return { sha: 'new-commit' };
    if (path.endsWith('/git/refs/heads/main')) return undefined;
    throw new Error(`Unexpected GitHub path: ${path}`);
  },
};

const result = await commitFiles({
  client,
  owner: 'owner',
  repo: 'repo',
  branch: 'main',
  message: 'test commit',
  files: [
    { path: 'a.txt', content: 'A' },
    { path: 'b.txt', content: 'B', mode: '100755' },
  ],
});

assert.deepEqual(result, { sha: 'new-commit' });
const treeCall = calls.find(({ path }) => path.endsWith('/git/trees'));
assert.ok(treeCall);
const treeBody = JSON.parse(treeCall.init.body);
assert.equal(treeBody.base_tree, 'parent-tree');
assert.deepEqual(treeBody.tree.map(({ path, mode }) => ({ path, mode })), [
  { path: 'a.txt', mode: '100644' },
  { path: 'b.txt', mode: '100755' },
]);

console.log('Foundation contracts: PASS');
