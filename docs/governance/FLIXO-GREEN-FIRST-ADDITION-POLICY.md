# FLIXO — Green-Before-Addition Repository Rule

## Rule

The repository is RED-locked for additions.

No new feature, product capability, architecture layer, agent, tool, registry entry, runtime surface, UI capability, integration, scale layer, or other additive scope may be introduced while the previous exact-SHA canonical test system is not fully GREEN.

## Required transition

RED → repair only → full canonical GREEN → additions reopened

A RED-state mutation must be explicitly classified as a repair with both [REPAIR:<ID>] and [WP:<ID>] markers. Existing repair protocol, mutation gate, control-plane authorization, targeted regression, and Exact-SHA certification remain authoritative.

## Canonical GREEN

Required workflow runs on the same exact parent SHA: FLIXO Test System; FLIXO WP0 Trust Baseline; FLIXO Test Impact; FLIXO Test Impact Execution; Repository Security Baseline; Claude Security Review.

Required checks on the same exact parent SHA: trust-gate; Exact-SHA promotion proof; Certification.

Missing, stale, queued, running, failed, cancelled, or SHA-mismatched evidence is not GREEN.

## Failure behavior

When the previous exact SHA is not fully GREEN and the current commit is not explicitly classified as a repair, the existing Engineering Work Package Guard fails closed with RED_TEST_SYSTEM_BLOCKS_NEW_ADDITIONS.

No exception may be created by weakening tests, skipping certification, or reclassifying stale evidence as GREEN.

## Architecture

This rule extends the existing Engineering Work Package Guard. It does not create a second control plane, executor, registry, event store, or tool chain. The only mutation lane remains execution → main, with no third branch.
