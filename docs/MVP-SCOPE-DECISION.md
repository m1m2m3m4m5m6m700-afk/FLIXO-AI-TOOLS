# FLIXO MVP Scope Decision Record

Status: CANONICAL
Decision date: 2026-09-27

## Decision

The Browser-First AI Editing MVP executable scope is exactly ten capabilities.

Image:
- `background-remover`
- `image-upscaler`
- `image-cropper`
- `image-compressor`
- `image-converter`
- `image-effects`

Video:
- `video-trimmer`
- `video-cropper`
- `video-resizer`
- `video-compressor`

## Basis

These ten capabilities are the current canonical executable/local set and are covered by the repository executable registry, executor coverage, output contracts, deterministic intent proof, and browser-oriented execution boundary.

The historical six-image set remains the image subset of the MVP. The four video capabilities are included because they are already implemented as executable local capabilities under the same canonical contract.

## Runtime authority

This document records product scope. Runtime authority remains the canonical tool/capability definitions and registry. The scope is mechanically enforced by the MVP scope contract and proof suite.

## Workflow contract

Every executable MVP capability supports:
1. Agent Guided Workflow.
2. Manual Standalone Workflow.

## Post-MVP boundary

Capabilities outside these ten IDs may remain recognized or plannable, but they are not executable MVP scope and must not become hidden MVP dependencies.

## Change control

A scope change requires a deliberate update to the canonical definitions, tests, documentation, and release review. Agents may not change the executable set unilaterally.
