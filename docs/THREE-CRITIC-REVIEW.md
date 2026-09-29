# FLIXO Three-Critic Review Worker

This worker is an advisory review layer on the existing \`execution\` line. It does not create branches, apply patches, commit, push, merge, promote, or certify.

## Pipeline

\`\`\`
exact checkout
  -> deterministic gate
  -> Security + Logic + Performance in parallel
  -> Security > Logic > Performance
  -> confidence gate
  -> fixer candidate only
  -> maximum 3 rounds
  -> ESCALATE_TO_HUMAN
\`\`\`

Required environment:

\`\`\`bash
export CRITIC_REPO_ROOT="$PWD"
export CRITIC_TYPECHECK_CMD='npm run typecheck'
export CRITIC_LINT_CMD='npm run lint'
export CRITIC_UNIT_TEST_CMD='npm run test:core'
export CRITIC_CODEQL_CMD='REAL CURRENT-SHA CODEQL COMMAND'
export ANTHROPIC_API_KEY='...'
export FLIXO_AGENT_MODEL='claude-sonnet-4-6'
\`\`\`

Any missing required gate is \`SKIPPED\` and blocks review. A failing required gate stops the pipeline before critic calls.

Local checks:

\`\`\`bash
python scripts/three_critic_review.py --self-test
python tests/three_critic_review.test.py
\`\`\`

Live review:

\`\`\`bash
python scripts/three_critic_review.py \\
  --review-patch artifacts/mini-swe-agent/repair.patch \\
  --goal 'Review the repair candidate against the exact execution SHA' \\
  --artifact artifacts/mini-swe-agent/review-artifact.json
\`\`\`

Safety invariants:
- Security confidence: 0.85
- Logic confidence: 0.70
- Performance confidence: 0.60
- Maximum critic rounds: 3
- Fixer output is a candidate diff only.
- Missing/stale/unconfigured deterministic evidence cannot yield APPROVED.
