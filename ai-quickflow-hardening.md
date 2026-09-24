# AI / QuickFlow Hardening Report

## Scope

The deterministic execution rule is explicit: QuickFlow is the execution authority. AI is an optional refinement layer and may not change the executable decision.

## Deterministic scenario matrix

| Scenario | Input | Deterministic decision | Actual post-hardening result |
|---|---|---|---|
| AI enabled correctly | `compress this image under 200KB and convert to WebP` | `image-converter(WebP) → image-compressor(200KB)` | AI is accepted only when its executable steps are equivalent to QuickFlow |
| AI disabled | same input | same two steps | deterministic local plan returned with no provider dependency |
| Network missing | same input + provider/network error | same two steps | provider failure falls back to deterministic QuickFlow |
| AI returns invalid result | same input + malformed provider payload | same two steps | malformed/invalid plan is rejected and deterministic plan returned |
| AI timeout | same input + provider timeout | same two steps | timeout is treated as provider failure and deterministic plan returned |
| AI returns a conflicting result | same input + valid-looking plan with different steps/parameters | same two steps | conflicting plan is rejected; QuickFlow remains authoritative |

## Boundary invariant

A provider plan must match the canonical tool-catalog fingerprint and the deterministic QuickFlow executable steps, including step order and normalized parameters. Provider workflow title and confidence are non-authoritative metadata.

When deterministic QuickFlow has no safe plan, a provider-generated plan cannot become an execution authority by itself.

## Regression coverage

`tests/ai-quickflow-hardening.unit.mjs` covers all six scenarios plus production-provider conflict handling, provider-only-plan rejection, deterministic stability, provider secret exposure checks, CORS/CSP checks, and the home-route lazy boundary.

## Loading and cost boundary

The home route keeps `FlixoAIAgent` behind a React lazy boundary. The client source has no provider API endpoints or provider credentials. Provider credentials remain server-side. The planner does not issue a provider request merely because the route is imported.

## Verification rule

The implementation is committed to the execution lane. Final closure requires fresh canonical CI evidence bound to the final exact SHA. Historical evidence is not reusable.
