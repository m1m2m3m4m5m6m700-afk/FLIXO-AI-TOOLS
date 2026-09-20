import { readFileSync } from 'node:fs';

const paths = [
  'docs/agents/ERROR-TEACHING-500.md',
  'docs/agents/ERROR-TEACHING-ADDITIONAL-500.md',
];
const lines = paths.flatMap((path) =>
  readFileSync(path, 'utf8').split(/\r?\n/u).filter((line) => /^T\d{3} \|/u.test(line)),
);

if (lines.length !== 1000) {
  console.error(`ERROR_TEACHING_CONTRACT_ERROR=expected_500_nonempty_lines actual_${lines.length}`);
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
console.log('ERROR_TEACHING_LINES=1000');
