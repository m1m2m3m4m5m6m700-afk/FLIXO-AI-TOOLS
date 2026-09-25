# FLIXO Developer Tool Stack v1

Status: IMPLEMENTED AS A GOVERNED CAPABILITY CATALOG on execution.

The stack is intentionally adapter-first. It does not install arbitrary packages or create a second product-tool registry. Existing repository commands are exposed as capabilities; external engines remain explicitly EXTERNAL/PLANNED until their executor and verifier are integrated.

## Capability families

- Code: TypeScript compiler, ESLint, repository search, AST analysis.
- Test: unit, real-browser E2E, property-based, mutation testing.
- Security: CodeQL, Semgrep, dependency audit.
- Runtime: browser console/network evidence and observability.
- Media: local image processing and video/effect engines.
- Repair: error fingerprinting, RCA/falsification, targeted repair, exact-SHA evidence.

## Authority and safety

Developer capabilities are not product capabilities. The existing canonical Tool/Capability Registry remains the source of truth for user-facing execution.

No developer capability may declare GREEN by itself. A mutating repair requires:
1. exact current execution SHA;
2. pre-mutation evidence and root-cause/falsification;
3. targeted regression;
4. affected-contract verification;
5. canonical CI;
6. independent certification.

A candidate tool cannot promote itself from PLANNED/EXTERNAL to AVAILABLE. Availability is a repository change reviewed through the same execution→main lane.

## Initial adoption

Available now means the repository already has a trustworthy command/evidence path. PLANNED means the capability is cataloged but its engine is not yet integrated. EXTERNAL means evidence must come from the provider/CI boundary.

This keeps the stack useful immediately without creating false-green signals or duplicate authorities.
