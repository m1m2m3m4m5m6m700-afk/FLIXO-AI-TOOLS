#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const CANONICAL_ACTIVE_WORK_BRANCH = 'execution';
export const CANONICAL_PRODUCTION_BRANCH = 'main';
export const CANONICAL_BRANCHES = Object.freeze([CANONICAL_ACTIVE_WORK_BRANCH, CANONICAL_PRODUCTION_BRANCH]);

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = Object.freeze(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.yml', '.yaml', '.sh']);
const SCAN_ROOTS = Object.freeze(['.github/workflows','scripts/ci','scripts/security','api','supabase/functions','src/lib/agent']);
const EXCLUDED_BASENAME = /^(?:test-|tests-)/u;
const SELF_PATH = 'scripts/ci/validate-two-branch-policy.mjs';
const violations = [];

function trackedSourceFiles() {
  const raw = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return raw.split('\0').filter(Boolean).filter((file) => {
    const normalized = file.replaceAll(path.sep, '/');
    if (normalized === SELF_PATH) return false;
    if (!SCAN_ROOTS.some((root) => normalized === root || normalized.startsWith(root + '/'))) return false;
    if (!SOURCE_EXTENSIONS.includes(path.extname(normalized))) return false;
    return !EXCLUDED_BASENAME.test(path.basename(normalized));
  });
}

const token = (value) => String(value ?? '').trim().replace(/^['"`]+|['"`]+$/gu, '').replace(/[;,]+$/u, '');
const lineOf = (source, index) => source.slice(0, index).split('\n').length;
const add = (file, rule, detail, line) => violations.push({ file, rule, detail, line });

function scanCommands(file, source) {
  const shellFile = /\.(?:ya?ml|sh)$/u.test(file);
  if (shellFile) {
    const shell = source.replace(/^\s*#.*$/gmu, '');
    const patterns = [
      ['THIRD_BRANCH_SWITCH_CREATE', /\bgit\s+switch\s+(?:-c|-C|--create|--force-create)\s+([^\s;&|]+)/giu],
      ['THIRD_BRANCH_CHECKOUT_CREATE', /\bgit\s+checkout\s+(?:-b|-B|--orphan)\s+([^\s;&|]+)/giu],
      ['THIRD_BRANCH_BRANCH_CREATE', /\bgit\s+branch\s+(?:-c|-C|-f|--force)\s+([^\s;&|]+)/giu],
      ['THIRD_BRANCH_WORKTREE_CREATE', /\bgit\s+worktree\s+add\s+(?:-b|-B|--checkout)\s+([^\s;&|]+)/giu],
    ];
    for (const [rule, re] of patterns) {
      for (const match of shell.matchAll(re)) {
        const branch = token(match[1]);
        if (!CANONICAL_BRANCHES.includes(branch)) add(file, rule, branch || 'DYNAMIC_OR_UNKNOWN_BRANCH', lineOf(shell, match.index ?? 0));
      }
    }
    for (const match of shell.matchAll(/\bgit\s+branch\s+([^\s;&|][^;&|]*?)(?:\s|$)/giu)) {
      const body = String(match[1] ?? '').trim();
      if (!body || /^--(?:show-current|list|all|remotes?|merged|no-merged|contains|format|sort|verbose|vv|column|color|ignore-case)\b/iu.test(body)) continue;
      const first = token(body.split(/\s+/u)[0]);
      if (!first || first.startsWith('-')) continue;
      if (!CANONICAL_BRANCHES.includes(first)) add(file, 'THIRD_BRANCH_GIT_BRANCH_CREATE', first, lineOf(shell, match.index ?? 0));
    }
    const pushMatch = shell.match(/\bgit\s+push\b[^\n]*(?:HEAD:|refs\/heads\/)([^\s]+)?/iu);
    if (pushMatch) {
      const pushed = token(pushMatch[1] ?? '');
      if (pushed && !CANONICAL_BRANCHES.includes(pushed)) add(file, 'THIRD_BRANCH_PUSH_FORBIDDEN', pushed, lineOf(shell, shell.indexOf(pushMatch[0])));
    }
    return;
  }

  const arrayPatterns = [
    ['THIRD_BRANCH_SWITCH_CREATE', /['"]git['"]\s*,\s*\[\s*['"]switch['"]\s*,\s*['"](?:-c|-C|--create|--force-create)['"]\s*,\s*([^\]\n]+?)(?:\s*,|\s*\])/giu],
    ['THIRD_BRANCH_CHECKOUT_CREATE', /['"]git['"]\s*,\s*\[\s*['"]checkout['"]\s*,\s*['"](?:-b|-B|--orphan)['"]\s*,\s*([^\]\n]+?)(?:\s*,|\s*\])/giu],
    ['THIRD_BRANCH_BRANCH_CREATE', /['"]git['"]\s*,\s*\[\s*['"]branch['"]\s*,\s*['"](?:-c|-C|-f|--force)['"]\s*,\s*([^\]\n]+?)(?:\s*,|\s*\])/giu],
    ['THIRD_BRANCH_WORKTREE_CREATE', /['"]git['"]\s*,\s*\[\s*['"]worktree['"]\s*,\s*['"]add['"]\s*,\s*['"](?:-b|-B|--checkout)['"]\s*,\s*([^\]\n]+?)(?:\s*,|\s*\])/giu],
  ];
  for (const [rule, re] of arrayPatterns) {
    for (const match of source.matchAll(re)) {
      const raw = String(match[1] ?? '').trim();
      const branch = token(raw);
      if (!/^['"][^'"]+['"]$/u.test(raw) || !CANONICAL_BRANCHES.includes(branch)) {
        add(file, rule, branch || 'DYNAMIC_OR_UNKNOWN_BRANCH', lineOf(source, match.index ?? 0));
      }
    }
  }
}
function scanRemoteRefs(file, source) {
  const refPost = /(?:git\/refs|git\/ref)[^\n]{0,300}(?:method\s*:\s*['"]POST['"]|--method\s+POST)/iu;
  if (refPost.test(source) && file !== 'scripts/ci/repair-lease.mjs') add(file, 'GITHUB_REF_CREATION_OUTSIDE_REPAIR_LEASE', 'POST to Git refs API', 1);
  if (file === 'scripts/ci/repair-lease.mjs') {
    if (source.includes("method: 'POST'") && !source.includes('REPAIR_LEASE_REF_TYPE_BLOCKED')) add(file, 'REPAIR_LEASE_REF_TYPE_GUARD_MISSING', 'missing hard ref-type guard', 1);
    if (!source.includes('^refs\/tags\/')) add(file, 'REPAIR_LEASE_TAG_ONLY_PATTERN_MISSING', 'missing refs/tags-only pattern', 1);
  }
  if (/(?:gh\s+api|curl|wget)[^\n]*(?:--method\s+POST|-X\s+POST)[^\n]*\/git\/refs\/heads\//iu.test(source)) add(file, 'GITHUB_BRANCH_REF_CREATE_FORBIDDEN', 'direct POST to refs/heads/*', 1);
  if (/\b(?:createBranch|createRef)\s*\(/u.test(source) && file !== 'scripts/ci/repair-lease.mjs') add(file, 'GITHUB_CREATE_REF_PRIMITIVE_FORBIDDEN', 'runtime createBranch/createRef primitive', 1);
}

export function validateTwoBranchPolicy() {
  const files = trackedSourceFiles();
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    scanCommands(file, source);
    scanRemoteRefs(file, source);
  }
  let currentBranch = 'UNKNOWN';
  try { currentBranch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim() || 'DETACHED'; } catch {}
  const result = {
    protocol: 'FLIXO-TWO-BRANCH-FAIL-CLOSED-v2',
    activeWorkBranch: CANONICAL_ACTIVE_WORK_BRANCH,
    productionBranch: CANONICAL_PRODUCTION_BRANCH,
    canonicalRoute: 'execution -> main',
    branchCreationAllowed: false,
    thirdBranchAllowed: false,
    currentBranch,
    scannedFiles: files.length,
    violations,
  };
  if (violations.length) throw new Error('TWO_BRANCH_POLICY_VIOLATION=' + JSON.stringify(result));
  return Object.freeze({ ...result, status: 'PASS' });
}

try { console.log(JSON.stringify(validateTwoBranchPolicy(), null, 2)); }
catch (error) { console.error(String(error?.message ?? error)); process.exitCode = 1; }