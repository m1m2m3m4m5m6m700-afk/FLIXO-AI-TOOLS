# FLIXO Environment Readiness Report

Evidence SHA: 41d44f132fa27892155fa0ab47fb1452b908b380

## Vercel

vercel.json sets git.deploymentEnabled=false. Automatic Git deployment is disabled; deployment is manual/provider-driven. The connected Vercel team was visible, but project discovery returned zero projects. Classification: EXTERNAL_DEPLOYMENT_UNVERIFIED.

## Cloudflare

wrangler.jsonc declares worker flixoai, compatibility date 2026-08-15, assets at ./dist, and SPA fallback. deploy-flixoai.yml is manual workflow_dispatch, requires an exact main SHA, rejects stale SHA, locks deployment to flixoai, performs a dry-run, deploys flixoai, and verifies an immutable SHA identity endpoint. External credentials were not used in this cycle. Classification: EXTERNAL_DEPLOYMENT_UNVERIFIED.

## Supabase / Chair-1

The central Chair-1 proof migration binds owner and delegator to assistantController and requires holder/task/work-package, exact SHA, lease, fencing token, expiry, and heartbeat agreement. Release requires successful task close. Source contract is present; live production release binding was not proven in this cycle. Classification: CODE_CONTRACT_PRESENT / LIVE_RELEASE_PROOF_UNVERIFIED.

## Council runtime

The previously verified blocker COUNCIL_TRUSTED_WORKFLOW_SHA_MISSING remains an external runtime configuration condition. MASTER-1 and MASTER-2 remain unverified until a fresh Activation -> ACK -> Session -> Heartbeat chain is observed.

## Environment decision

Environment readiness is NOT CLOSED for production promotion.