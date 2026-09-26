# FLIXO — Bounded Scope During Canonical GREEN Pending

## Rule

The repository may continue bounded product, agent, architecture, tooling, integration, and research development while the previous exact-SHA canonical test system is RED.

Every RED-state mutation must be explicitly classified:

- Repair scope: `[REPAIR:<ID>] [WP:<ID>]`
- Additive scope: `[ADD:<ID>] [WP:<ID>]`

This classification is an execution-scope marker, not a GREEN claim.

## Required safety invariants

RED-compatible work must not weaken or skip tests, weaken security controls, alter certification semantics to obtain GREEN, bypass mutation gates, create a second control plane/executor/registry/event store/publication authority, mutate `main` directly, create a third branch, or reuse stale evidence as GREEN.

## Canonical GREEN

The canonical workflows and checks remain authoritative. A RED state may coexist with active development; successful additive work does not itself become GREEN.

## Failure behavior

An unclassified mutation on a RED parent is rejected with `RED_SCOPE_REQUIRES_EXPLICIT_CLASSIFICATION`.

A correctly classified repair or additive scope is allowed to proceed, but the repository remains RED until fresh exact-SHA canonical evidence proves GREEN.

## Architecture

This policy extends the existing Engineering Work Package Guard. It does not create another control plane or mutation lane. The only publication path remains `execution → main`, with no third branch.


## Documentation is not an exemption

Documentation, governance text, README/CONTRIBUTING edits, and policy prose are repository mutations for Green-First purposes. They are not exempt merely because they do not change runtime code. While canonical GREEN is pending, such changes must carry the same [REPAIR:<ID>] [WP:<ID>] or [ADD:<ID>] [WP:<ID>] classification and pass the same canonical verification gates.
