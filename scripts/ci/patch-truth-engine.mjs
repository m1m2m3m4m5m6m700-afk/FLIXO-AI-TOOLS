#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SHA_RE = /^[a-f0-9]{40}$/u;
const HASH_RE = /^[a-f0-9]{64}$/u;
const arg = (name, fallback = '') => {
  const prefix = '--' + name + '=';
  const hit = process.argv.find((v) => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const assertSha = (value, label) => {
  const v = String(value ?? '').trim();
  if (!SHA_RE.test(v)) throw new Error('PATCH_TRUTH_' + label + '_INVALID');
  return v;
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.', { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

export function derivePatchTruth({ baseSha, candidateSha, expected = null } = {}) {
  const base = assertSha(baseSha, 'BASE_SHA');
  const candidate = assertSha(candidateSha, 'CANDIDATE_SHA');
  const head = assertSha(git(['rev-parse', 'HEAD']), 'HEAD');
  if (head !== candidate) throw new Error('PATCH_TRUTH_CANDIDATE_NOT_HEAD');
  if (base === candidate) throw new Error('PATCH_TRUTH_EMPTY_CANDIDATE');
  const parents = git(['rev-list', '--parents', '-n', '1', candidate]).split(/\s+/u).filter(Boolean).slice(1);
  if (!parents.includes(base)) throw new Error('PATCH_TRUTH_PARENT_MISMATCH');
  const binaryDiff = execFileSync('git', ['diff', '--binary', base, candidate], { cwd: ROOT });
  const changedPaths = git(['diff', '--name-only', base, candidate]).split(/\r?\n/u).filter(Boolean).sort();
  const treeSha = git(['show', '-s', '--format=%T', candidate]);
  const commitMessage = git(['show', '-s', '--format=%B', candidate]).replace(/\s+$/u, '');
  const patchSha256 = sha256(binaryDiff);
  const truth = {
    schemaVersion: 1,
    protocol: 'FLIXO-PATCH-TRUTH-v1',
    authority: 'GIT_REDERIVED',
    trustRule: 'PATCH_TEXT_IS_NEVER_AUTHORITATIVE',
    baseSha: base,
    candidateSha: candidate,
    candidateParentSha: parents[0] ?? null,
    candidateTreeSha: treeSha,
    commitMessage,
    changedPaths,
    changedPathDigest: sha256(JSON.stringify(changedPaths)),
    patchSha256,
    patchBytes: Buffer.byteLength(binaryDiff),
    patchTextAcceptedAsEvidence: false,
    rederivedFromGit: true,
    exactHead: true,
    generatedAt: new Date().toISOString()
  };
  if (expected) {
    if (expected.baseSha !== truth.baseSha) throw new Error('PATCH_TRUTH_EXPECTED_BASE_MISMATCH');
    if (expected.candidateSha !== truth.candidateSha) throw new Error('PATCH_TRUTH_EXPECTED_CANDIDATE_MISMATCH');
    if (expected.patchText) throw new Error('PATCH_TRUTH_REJECTS_AGENT_PATCH_TEXT');
    if (!HASH_RE.test(truth.patchSha256) || expected.patchSha256 !== truth.patchSha256) {
      throw new Error('PATCH_TRUTH_PATCH_DIGEST_MISMATCH');
    }
    if (JSON.stringify([...(expected.changedPaths ?? [])].sort()) !== JSON.stringify(changedPaths)) {
      throw new Error('PATCH_TRUTH_CHANGED_PATHS_MISMATCH');
    }
  }
  return truth;
}

if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) {
  const expectedFile = arg('expected');
  const truth = derivePatchTruth({
    baseSha: arg('base'),
    candidateSha: arg('candidate'),
    expected: expectedFile ? readJson(expectedFile) : null
  });
  const output = arg('output', '/tmp/flixo-patch-truth.json');
  writeJson(output, truth);
  console.log(JSON.stringify(truth, null, 2));
}
