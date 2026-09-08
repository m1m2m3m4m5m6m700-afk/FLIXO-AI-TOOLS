#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2] || 'playwright-report/results.json';
if (!fs.existsSync(file)) throw new Error(`Missing Playwright JSON evidence: ${file}`);
const text = fs.readFileSync(file, 'utf8');
if (!text.trim()) throw new Error(`Empty Playwright JSON evidence: ${file}`);
let value;
try {
  value = JSON.parse(text);
} catch (error) {
  throw new Error(`Malformed Playwright JSON evidence ${file}: ${error.message}`, { cause: error });
}
if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid Playwright JSON root in ${file}`);
if (!Array.isArray(value.suites)) throw new Error(`Playwright JSON evidence missing suites[] in ${file}`);
console.log(`PLAYWRIGHT_EVIDENCE_VALID=1 file=${file}`);
