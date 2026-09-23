import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_SERVERLESS_FUNCTIONS = 12;
const apiRoot = join(process.cwd(), 'api');

function collectFiles(directory) {
  if (!statSync(directory, { throwIfNoEntry: false })) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\\.(?:[cm]?js|tsx?)$/.test(entry.name) ? [path] : [];
  });
}

const files = collectFiles(apiRoot).sort();
console.log('VERCEL_FUNCTION_FILE_COUNT=' + files.length);
for (const file of files) console.log('VERCEL_FUNCTION_FILE=' + file.slice(process.cwd().length + 1));

if (files.length === 0) throw new Error('VERCEL_FUNCTION_FILE_COUNT=0');
if (files.length > MAX_SERVERLESS_FUNCTIONS) {
  throw new Error('VERCEL_FUNCTION_BUDGET_EXCEEDED:' + files.length + '>' + MAX_SERVERLESS_FUNCTIONS);
}

console.log('VERCEL_FUNCTION_BUDGET=PASS');
