import { readFileSync } from 'node:fs';

const targets = {
  maxPRMinutes: 20,
  maxFullCertificationMinutes: 45,
  maxRequiredCheckCount: 8
};
const evidence = process.env.EVIDENCE_SUMMARY ? JSON.parse(readFileSync(process.env.EVIDENCE_SUMMARY, 'utf8')) : null;
const actual = {
  prMinutes: Number(process.env.CI_ELAPSED_MINUTES || 0),
  fullMinutes: Number(process.env.CI_FULL_ELAPSED_MINUTES || 0),
  requiredChecks: Number(process.env.CI_REQUIRED_CHECKS || 0)
};
const failures = [];
if (actual.prMinutes > targets.maxPRMinutes) failures.push(`PR SLO exceeded: ${actual.prMinutes}m > ${targets.maxPRMinutes}m`);
if (actual.fullMinutes > targets.maxFullCertificationMinutes) failures.push(`full certification SLO exceeded: ${actual.fullMinutes}m > ${targets.maxFullCertificationMinutes}m`);
if (actual.requiredChecks > targets.maxRequiredCheckCount) failures.push(`required check count exceeded: ${actual.requiredChecks} > ${targets.maxRequiredCheckCount}`);
if (evidence?.result === 'FAIL') failures.push('evidence summary reports FAIL');
console.log(JSON.stringify({ targets, actual, evidence: evidence?.sha ?? null, result: failures.length ? 'FAIL' : 'PASS', failures }, null, 2));
if (failures.length) process.exit(1);
