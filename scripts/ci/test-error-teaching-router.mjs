import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const router = JSON.parse(readFileSync('docs/agents/ERROR-TEACHING-ROUTER.json', 'utf8'));
const base = readFileSync('docs/agents/ERROR-TEACHING-500.md', 'utf8');
const additional = readFileSync('docs/agents/ERROR-TEACHING-ADDITIONAL-500.md', 'utf8');
const expanded = ['A','B','C','D'].map((letter) => readFileSync('docs/agents/ERROR-TEACHING-EXPANDED-'+letter+'-1000.md', 'utf8'));
const rules = [...base.split(/\r?\n/u), ...additional.split(/\r?\n/u), ...expanded.flatMap((text) => text.split(/\r?\n/u))].filter((line) => /^T\d{3,4} \|/u.test(line));
if (rules.length !== 5000 || new Set(rules).size !== 5000) {
  console.error(`ERROR_TEACHING_ROUTE_CONTRACT_ERROR=corpus_invalid_${rules.length}`);
  process.exit(1);
}
const classes = [...new Set(rules.map((line) => line.match(/\| class=([^|]+)/u)?.[1]?.trim()).filter(Boolean))];
const routed = new Set(router.groups.flatMap((group) => group.classes));
if (classes.some((item) => !routed.has(item)) || routed.size !== classes.length) {
  console.error('ERROR_TEACHING_ROUTE_CONTRACT_ERROR=class_coverage_mismatch');
  process.exit(1);
}
const cases = [
 ['i18n','i18n.md'],['i18n-rtl','i18n.md'],['translation missing Arabic','i18n.md'],
 ['workflow-event','workflow.md'],['playwright-webkit','browser-rendering.md'],
 ['artifact-schema','artifacts.md'],['supabase-query','integrations.md'],
 ['typescript','vite-build.md'],['stale-sha','ci-control.md']
];
for (const [q, expected] of cases) {
 const out=execFileSync(process.execPath,['scripts/ci/error-teaching-router.mjs',q],{encoding:'utf8'}).trim();
 const got=JSON.parse(out);
 if (!got.route.endsWith('/'+expected) || !Array.isArray(got.ruleIds)) {
   console.error(`ERROR_TEACHING_ROUTE_CONTRACT_ERROR=query_${q}`);
   process.exit(1);
 }
}
try {
 execFileSync(process.execPath,['scripts/ci/error-teaching-router.mjs','unknown-unmapped-error'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 console.error('ERROR_TEACHING_ROUTE_CONTRACT_ERROR=unknown_query_did_not_fail_closed');
 process.exit(1);
} catch { /* expected fail-closed result */ }
console.log('ERROR_TEACHING_ROUTE_CONTRACT=PASS');
console.log('ERROR_TEACHING_ROUTED_CLASSES='+classes.length);
