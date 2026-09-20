import { readFileSync } from 'node:fs';

const basePath = 'docs/agents/ERROR-TEACHING-500.md';
const additionalPath = 'docs/agents/ERROR-TEACHING-ADDITIONAL-500.md';
const baseLines = readFileSync(basePath, 'utf8').split(/\r?\n/u).filter((line) => /^T\d{3,4} \|/u.test(line));
const additionalLines = readFileSync(additionalPath, 'utf8').split(/\r?\n/u).filter((line) => /^T\d{3,4} \|/u.test(line));
const lines = [...baseLines, ...additionalLines];

if (lines.length !== 1000) {
  console.error(`ERROR_TEACHING_CONTRACT_ERROR=expected_1000_rules actual_${lines.length}`);
  process.exit(1);
}

if (baseLines.length !== 500 || additionalLines.length !== 500) {
  console.error(`ERROR_TEACHING_CONTRACT_ERROR=expected_500_rules_per_chapter base=${baseLines.length} additional=${additionalLines.length}`);
  process.exit(1);
}
if (new Set(lines).size !== 1000) {
  console.error('ERROR_TEACHING_CONTRACT_ERROR=duplicate_rule_lines_detected');
  process.exit(1);
}
const extractClass = (line) => line.match(/\| class=([^|]+)/u)?.[1] ?? '';
const baseClasses = new Set(baseLines.map(extractClass));
const additionalClasses = new Set(additionalLines.map(extractClass));
const classOverlap = [...additionalClasses].filter((item) => baseClasses.has(item));
if (classOverlap.length > 0) {
  console.error(`ERROR_TEACHING_CONTRACT_ERROR=class_overlap_detected count=${classOverlap.length}`);
  process.exit(1);
}

for (let i = 0; i < lines.length; i += 1) {
  const expectedId = `T${String(i + 1).padStart(3, '0')}`;
  if (!lines[i].startsWith(`${expectedId} |`)) {
    console.error(`ERROR_TEACHING_CONTRACT_ERROR=unexpected_id_at_line_${i + 1}`);
    process.exit(1);
  }

  for (const field of ['class=', 'stage=', 'trigger=', 'invariant=', 'action=', 'teaching=', 'verify=']) {
    if (!lines[i].includes(`| ${field}`) && !lines[i].includes(`|${field}`)) {
      console.error(`ERROR_TEACHING_CONTRACT_ERROR=missing_${field}_at_${expectedId}`);
      process.exit(1);
    }
  }
}

const prompt = readFileSync('docs/agents/prompts/RPR-ERROR-RCA-001.md', 'utf8');
if (!prompt.includes('docs/agents/ERROR-TEACHING-500.md') || !prompt.includes('docs/agents/ERROR-TEACHING-ADDITIONAL-500.md')) {
  console.error('ERROR_TEACHING_CONTRACT_ERROR=RCA_prompt_not_bound_to_teaching_corpus');
  process.exit(1);
}
if (!prompt.includes('TEACHING_RULE_MATCHED') || !prompt.includes('TEACHING_RULE_CONTRADICTED')) {
  console.error('ERROR_TEACHING_CONTRACT_ERROR=learning_outcome_contract_missing');
  process.exit(1);
}

console.log('ERROR_TEACHING_CONTRACT=PASS');
const route = JSON.parse(readFileSync('docs/agents/ERROR-TEACHING-ROUTER.json', 'utf8'));
const routedClasses = new Set(route.groups.flatMap((group) => group.classes));
const corpusClasses = new Set(lines.map(extractClass));
if (routedClasses.size !== corpusClasses.size || [...corpusClasses].some((className) => !routedClasses.has(className))) {
  console.error('ERROR_TEACHING_CONTRACT_ERROR=router_class_coverage_mismatch');
  process.exit(1);
}
console.log('ERROR_TEACHING_LINES=1000');
console.log('ERROR_TEACHING_ROUTER=PASS');
