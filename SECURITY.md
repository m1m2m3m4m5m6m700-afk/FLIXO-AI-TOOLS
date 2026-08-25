# Security Policy

## Scope

This policy covers the FLIXO-AI-TOOLS repository, its source code, CI workflows, and production-facing configuration.

## Secrets

Never commit API keys, access tokens, passwords, private keys, database credentials, or `.env` files. Local environment files are intentionally ignored by Git; use `.env.example` for non-sensitive configuration documentation.

Production and CI secrets must be stored in the appropriate secret store (for example GitHub Actions secrets or the deployment provider's encrypted environment variables). Secrets must not be exposed to client-side bundles unless the value is explicitly designed to be public.

## Least privilege

Use narrowly scoped credentials. Prefer repository/environment-specific tokens, read-only credentials where possible, and short-lived credentials for automation.

## Rotation

If a secret may have been exposed:

1. Revoke or rotate it immediately at the provider.
2. Remove the secret from the working tree and commit history when required.
3. Replace the affected CI/deployment secret.
4. Re-run the relevant security and release checks.
5. Record the incident and corrective action without publishing the secret value.

Removing a secret from the latest commit does not make a previously exposed credential safe; treat any credential present in repository history as compromised until rotated.

## Reporting a vulnerability

Do not open a public issue containing exploitable details or secret values. Report security-sensitive findings privately to the repository owner through the GitHub security reporting mechanism available for the repository.

Please include the affected component, reproduction steps, impact assessment, and a safe remediation suggestion when available. Do not include credentials, personal data, or other sensitive values in the report.

## CI security requirements

Security checks must remain enabled. A failing security gate must not be bypassed solely to obtain a green build. External service failures must be classified separately from application-code failures.

Changes to authentication, authorization, secret handling, dependency execution, or CI permissions require targeted review and fresh evidence on the exact commit being promoted.
