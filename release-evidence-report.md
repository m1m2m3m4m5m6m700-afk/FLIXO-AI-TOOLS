# FLIXO Release Evidence Report

Evidence snapshot: 2026-09-24
Exact execution SHA: 41d44f132fa27892155fa0ab47fb1452b908b380
Production main snapshot: 1a26c4a3624ec7ae58a8c52191246dda423de5bb
Canonical Test System: 35957628269
Certification job: 107500671225

## Gate status

| Gate | Result | Exact-SHA evidence |
|---|---|---|
| npm ci | GREEN | Static + Build job ran npm ci successfully |
| npm run verify:fast | GREEN by exact equivalent | verify:fast maps to test:static; static gate passed |
| npm run check | RED / NOT DIRECTLY PROVEN | Constituent checks passed, but literal check was not executed on the certified run |
| npm run verify | RED / NOT PROVEN | No exact-SHA proof of audit:production |
| Browser E2E | GREEN | FAST 66/66 and DEEP 60/60 semantic units |
| C4 | GREEN | Completed Certification job, exact SHA, zero errors |
| Work Package / RCA / Proof Guard | RED | Job 107499197270, scripts/ci/work-package-policy.mjs:20 |

## Certification

certification.json: PASS; exactSha matches 41d44f132fa27892155fa0ab47fb1452b908b380; FAST 66/66; DEEP 60/60; 20 locales; errors empty.

## Evidence chain

commit -> Test System -> FAST -> DEEP -> Certification -> certification artifact.

## Decision

Production promotion is NOT CLOSED. The browser/C4 layer is green, but the literal verify gate, governance guard, and production deployment provenance are not fully closed.