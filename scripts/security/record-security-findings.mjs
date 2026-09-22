#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const reportPath = process.argv.find(v => v.startsWith('--report='))?.slice(9);
const outputPath = process.argv.find(v => v.startsWith('--output='))?.slice(9) ?? '/tmp/security-red-team-record.json';
if (!reportPath) throw new Error('SECURITY_LEDGER_REPORT_REQUIRED');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const expectedSha = String(report.targetSha ?? process.env.GITHUB_SHA ?? '').trim();
const botId = String(report.botId ?? '').trim();
const reportAuthority = String(report.authority ?? '').trim();
const mutationAuthority = report.mutationAuthority;

if (!/^[0-9a-f]{40}$/u.test(expectedSha)) throw new Error('SECURITY_LEDGER_EXPECTED_SHA_INVALID');
if (!botId) throw new Error('SECURITY_LEDGER_BOT_ID_REQUIRED');
if (reportAuthority !== 'READ_ONLY_SECURITY_DISCOVERY' || mutationAuthority !== false) {
  throw new Error('SECURITY_LEDGER_REPORT_AUTHORITY_INVALID');
}

const findings = Array.isArray(report.findings) ? report.findings : [];
const findingDigest = createHash('sha256')
  .update(JSON.stringify(findings), 'utf8')
  .digest('hex');

const record = {
  schemaVersion: 2,
  protocol: 'FLIXO-SECURITY-REDTEAM-RECORD-v2',
  status: 'EVIDENCE_RECORDED_READ_ONLY',
  authority: 'READ_ONLY_SECURITY_DISCOVERY',
  mutationAuthority: false,
  botId,
  exactSha: expectedSha,
  findingCount: findings.length,
  findingDigest,
  findings,
  recordedAt: new Date().toISOString(),
};

fs.mkdirSync(new URL('.', `file://${outputPath}`).pathname, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({
  status: record.status,
  botId,
  exactSha: expectedSha,
  findingCount: findings.length,
  findingDigest,
  mutation: 'NONE',
  output: outputPath,
}, null, 2));
