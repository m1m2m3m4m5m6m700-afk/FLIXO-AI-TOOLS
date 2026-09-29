# FLIXO MVP Release Checklist

## Candidate identity

Record one candidate SHA only:

- Current execution SHA:
- Tested SHA:
- Built SHA:
- Browser-verified SHA:
- Security/CodeQL SHA:
- Coverage-certified SHA:
- Certified SHA:
- Deployed SHA:

All recorded SHAs must be identical before release promotion.

## Code and tests

- [ ] TypeScript clean
- [ ] ESLint clean
- [ ] Production build succeeds
- [ ] Core contract suite succeeds
- [ ] Deterministic MVP intent corpus is 100% exact
- [ ] Agent Guided Workflow E2E succeeds
- [ ] Manual Standalone Workflow E2E succeeds
- [ ] Fallback E2E succeeds
- [ ] Red-Team regression suite succeeds

## Runtime boundary

- [ ] All executable MVP capabilities are canonical
- [ ] Registry → execution gate → executor → verifier → artifact is the only execution path
- [ ] No raw File/Blob bytes are sent to providers
- [ ] Provider calls are planning-only
- [ ] Local file execution requires no backend
- [ ] Resource, timeout, abort, file-size and pixel limits are enforced
- [ ] Visual-goal verification fails closed when required proof cannot be established

## Security and trust

- [ ] CodeQL is successful on the candidate SHA
- [ ] Dependency/security audit is successful
- [ ] Secret scanning is successful
- [ ] Provider URL/response/request limits are enforced
- [ ] SSE/error handling does not expose internal exceptions
- [ ] External agent workers have no merge/promotion/certification authority

## Governance

- [ ] PR targets `main` from `execution`
- [ ] Independent human review is present
- [ ] Code Owner policy is enforced where required
- [ ] Required status checks are strict
- [ ] `main` is protected
- [ ] No direct write to `main`
- [ ] No stale/cancelled/skipped evidence is accepted

## Deployment

- [ ] Deployment source is current `main`
- [ ] Build artifact carries the exact release SHA
- [ ] Cloudflare worker target is `flixoai`
- [ ] Production immutable identity matches the release SHA
- [ ] Production root returns valid HTML
- [ ] Production browser smoke succeeds
- [ ] Deployed SHA equals certified SHA

## Release freeze

After candidate freeze, allow only bug fixes, security fixes, contract-correct test fixes, and documentation corrections. Feature work starts a new release cycle.
