# FLIXO Admin Control Center

## Current implementation

The admin surface contains survey CRUD, question building, response review, CSV export, role definitions, audit UI, and private `noindex` metadata.

## Server authentication

Admin credentials are server-side only. `ADMIN_PASSWORD_HASH` stores an scrypt password hash and `ADMIN_SESSION_SECRET` signs an HTTP-only session cookie through TanStack Start's session API.

Generate a password hash locally:

```bash
node scripts/generate-admin-password-hash.mjs
```

Do not commit either secret. Production requires both variables to be configured. Missing configuration fails closed for authentication.

## Roles

- `owner`: full administration.
- `admin`: survey and operational administration.
- `analyst`: read-only analytics and response access.

The role contract is defined server-side and must not be inferred from browser state.

## Data persistence rollout

Survey storage must move from the prototype browser store to PostgreSQL-backed server functions before production exposure. The existing repository already contains a proven Drizzle/Postgres + server-function + CSRF/rate-limit pattern on the historical `feat/real-admin-data` line; the Admin implementation should reuse that pattern rather than create a second database stack.

## Release gate

No Admin production rollout is considered certified until the exact PR head passes TypeScript, lint, build, security, contract checks, and browser smoke. A Vercel rate-limit status is an external deployment signal and must not be interpreted as application-test evidence.
