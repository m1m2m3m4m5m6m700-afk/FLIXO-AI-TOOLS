# FLIXO Open-Source Capability Matrix

**Status:** DOCUMENTATION ONLY / NO RUNTIME MUTATION  
**Date:** 2026-09-25  
**Canonical mutation path:** `execution → main`  
**Current policy:** No new runtime/product architecture is activated while canonical RED remains open. This document records reusable capabilities and adoption boundaries only.

## 1. Purpose

This matrix evaluates mature open-source agent, repair, sandbox, and benchmark repositories for capabilities that can strengthen FLIXO without creating a second mutation authority, a third branch, or a parallel control plane.

The governing rule is:

`External capability → isolated/advisory input → FLIXO gates → FLIXO verifier → canonical publication`

External repositories do **not** receive FLIXO mutation authority, main-write authority, certification authority, or independent dispatch authority.

## 2. Capability Matrix

| Source repository | Useful capability | FLIXO use | Adoption state | Explicit boundary |
|---|---|---|---|---|
| [OpenHands/software-agent-sdk](https://github.com/OpenHands/software-agent-sdk) | Agent, Conversation, Tool, Workspace, Agent Server primitives | Primary external repair advisor; isolated candidate proposal generation; reusable agent/tool patterns | **ACTIVE / ALREADY INTEGRATED** | No commit, push, branch creation, main mutation, certification, or publication authority |
| [SWE-agent/SWE-ReX](https://github.com/SWE-agent/SWE-ReX) | Sandboxed shell execution, remote/local environments, parallel sessions | Candidate future execution-infrastructure reference; compare against existing FLIXO detached worktree isolation | **EVALUATE ONLY** | Do not introduce a second runtime/control plane before canonical GREEN |
| [SWE-agent/mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) | Minimal agent loop, tool interaction, compact execution model | Reference implementation for reducing unnecessary orchestration complexity; benchmark/control comparison | **REFERENCE / BENCHMARK** | Do not replace FLIXO repair engine or governance |
| [Aider-AI/aider](https://github.com/Aider-AI/aider) | Repository map, context selection, codebase navigation | Improve file/context localization for RCA and repair proposals | **REFERENCE** | Git integration is not imported; FLIXO branch prohibition remains authoritative |
| [SWE-bench/SWE-smith](https://github.com/SWE-bench/SWE-smith) | Large-scale SWE task and training-data generation | Future source of repair scenarios, trajectories, and adversarial training data | **POST-GREEN RESEARCH** | No dataset/runtime dependency is added to the active repair lane while RED remains |
| [SWE-bench/SWE-bench](https://github.com/SWE-bench/SWE-bench) | Real-world software repair benchmark and evaluation harness | External capability benchmark for measuring FLIXO repair performance | **POST-GREEN BENCHMARK** | Benchmark results never substitute for FLIXO canonical CI or exact-SHA certification |
| [eclipse-repairnator/repairnator](https://github.com/eclipse-repairnator/repairnator) | Automated repair/build-failure repair patterns and historical APR research | Reference for repair classifications, patch-generation patterns, and historical lessons | **REFERENCE / HISTORICAL** | No second repair authority or mutation lane |
| [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | Full OpenHands control-center/frontend architecture | Architecture reference only where useful to agent UX and orchestration boundaries | **REFERENCE** | Do not import the full OpenHands control plane into FLIXO |

## 3. What FLIXO should actually reuse

### A. Repair intelligence

Use the strongest ideas from OpenHands, mini-SWE-agent, Aider, SWE-agent, and Repairnator to improve:

- repository/context localization;
- failure-to-file mapping;
- candidate patch generation;
- tool-use loops;
- repair strategy diversity;
- failure classification;
- historical repair retrieval.

The output remains a **proposal**, not an authorized mutation.

### B. Isolated execution

SWE-ReX is the main external reference for strengthening the isolated execution boundary.

Before any runtime adoption, FLIXO must compare it against the already-existing detached-worktree OpenHands advisor path and prove that it adds a capability that FLIXO does not already have. Mere duplication is not sufficient reason for integration.

### C. Training and evaluation

SWE-smith and SWE-bench should become external evaluation sources after the current RED/verification cycle is closed.

A future FLIXO evaluation stack can therefore separate:

`FLIXO internal CI` = operational correctness  
`SWE-bench` = external repair capability  
`SWE-smith` = scenario/data generation  
`Action Vault` = FLIXO historical learning

These are complementary evidence sources, not replacements for each other.

## 4. What must NOT be imported

The following capabilities are intentionally excluded from direct adoption:

1. A second Git mutation authority.
2. Automatic branch creation or third-branch workflows.
3. Direct main writes.
4. A second publication/certification authority.
5. A parallel FLIXO council/control plane.
6. An external scheduler that can independently dispatch FLIXO repair.
7. A benchmark result being treated as production GREEN.
8. A dependency added only because another project uses it, without a proven FLIXO capability gap.

## 5. Proposed capability flow

```text
RED / FAILURE
      ↓
FLIXO RCA + exact SHA
      ↓
OPENHANDS PRIMARY ADVISOR
      ↓
SWE-style / historical / deterministic proposals
      ↓
FLIXO proposal comparison + safety gates
      ↓
Canonical mutation authority
      ↓
Targeted regression
      ↓
Canonical CI
      ↓
Exact-SHA certification
      ↓
execution → main
```

External projects are therefore **capability providers and references**, not governance participants.

## 6. Adoption gates

Any future code-level adoption from one of these repositories must satisfy all of the following before runtime activation:

- exact capability gap demonstrated in FLIXO;
- no duplication of an existing canonical capability;
- license compatibility verified;
- dependency/security impact reviewed;
- isolated test coverage added;
- failure and rollback behavior defined;
- no new mutation lane;
- no branch creation;
- no direct main mutation;
- exact-SHA verification remains authoritative;
- canonical CI remains the only GREEN authority.

## 7. Current implementation decision

The first concrete integration is already established for OpenHands:

`OPENHANDS → ACTION-REPAIR → HISTORICAL → DETERMINISTIC`

OpenHands is consulted as the primary proposal source when it returns a valid exact-SHA candidate. FLIXO's existing repair gates, verifier, publication authority, and canonical GREEN remain authoritative.

The other repositories are recorded as capability references until a specific proven gap justifies implementation.

## 8. Source links

- https://github.com/OpenHands/software-agent-sdk
- https://github.com/OpenHands/OpenHands
- https://github.com/SWE-agent/SWE-ReX
- https://github.com/SWE-agent/mini-swe-agent
- https://github.com/Aider-AI/aider
- https://github.com/SWE-bench/SWE-smith
- https://github.com/SWE-bench/SWE-bench
- https://github.com/eclipse-repairnator/repairnator
## 9. Image-Editing AI Capability Layer

This second research layer is specifically for the FLIXO product goal: a conversational image-editing assistant that understands the image, identifies the intended region/object, selects an editing operation, executes it, and verifies the visual result.

| Source repository | Capability | FLIXO opportunity | State | Boundary |
|---|---|---|---|---|
| [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) / [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Node/graph-based image workflow execution, reusable workflow composition, API/backend | Reference for representing complex multi-tool image transformations as explicit execution graphs | **REFERENCE / EVALUATE AFTER GREEN** | Do not import the full UI/runtime; FLIXO keeps its own Tool/Capability Registry and Execution Gate |
| [invoke-ai/InvokeAI](https://github.com/invoke-ai/InvokeAI) | Canvas-centric editing, inpainting masks, lasso/region selection, workflow execution against canvas images | Reference for region-aware editing UX and image-to-workflow execution | **REFERENCE** | No second canvas/runtime or parallel execution authority |
| [Acly/krita-ai-diffusion](https://github.com/Acly/krita-ai-diffusion) | Selection-based inpainting/outpainting, controlled editing, references, sketches, line art, depth maps | Strong reference for precise user intent translated into constrained visual edits | **REFERENCE / HIGH VALUE** | Reuse concepts and contracts; do not import the Krita plugin architecture |
| [huggingface/diffusers](https://github.com/huggingface/diffusers) | Modular diffusion pipelines, image-to-image, inpainting and composable model components | Candidate inference substrate for future FLIXO AI editing capabilities | **REFERENCE / FUTURE IMPLEMENTATION** | Any model runtime must enter through FLIXO Capability Registry → Execution Gate → Executor → Verification |
| [facebookresearch/segment-anything](https://github.com/facebookresearch/segment-anything) / SAM 2 family | Promptable segmentation from points/boxes and visual masks | Foundation for turning phrases such as “the person”, “the sky”, or “the left object” into editable regions | **REFERENCE / HIGH VALUE** | Segmentation output is evidence/input to editing, never direct authorization |
| [IDEA-Research/GroundingDINO](https://github.com/IDEA-Research/GroundingDINO) | Open-set text-conditioned object detection; language-to-box grounding; compatibility with SAM and editing pipelines | Candidate grounding layer from natural language object references to bounding regions | **REFERENCE / HIGH VALUE** | Detection confidence must be verified; absence/ambiguity must fail closed or trigger clarification |
| [IDEA-Research/Grounded-Segment-Anything](https://github.com/IDEA-Research/Grounded-Segment-Anything) | Grounding DINO + SAM composition for text-prompted detection/segmentation and controllable editing | Reference architecture for intent → locate → mask → edit | **REFERENCE / HIGH VALUE** | Treat this as a capability pattern, not a new end-to-end FLIXO runtime |

### 9.1 Proposed visual execution chain

```text
User language
   ↓
Intent / Clarification
   ↓
Visual grounding
   ├─ Grounding DINO → object/region candidates
   └─ SAM/SAM2       → pixel mask
   ↓
Edit Planner
   ├─ local edit / inpaint
   ├─ remove / replace
   ├─ extend / outpaint
   ├─ style / appearance
   └─ global transformation
   ↓
Inference / Workflow Engine
   ├─ Diffusers pipelines
   └─ workflow graph reference (ComfyUI/InvokeAI patterns)
   ↓
Visual Verification
   ├─ target region preserved/changed as intended
   ├─ prompt/intent adherence
   ├─ artifact detection
   └─ output integrity
   ↓
User-visible result + revision loop
```

### 9.2 Important architectural finding

The strongest reusable idea from this research is **not** to copy one repository wholesale. It is to separate the visual editing problem into contracts:

`Intent → Grounding → Region/Mask → Edit Plan → Execution → Visual Verification → Revision`

This aligns naturally with the existing FLIXO intent, capability registry, execution, and verification layers. It also leaves room for multiple inference backends without changing the user-facing Agent contract.

### 9.3 Immediate research priorities after canonical GREEN

1. **Visual Grounding spike:** evaluate Grounding DINO + SAM/SAM2 on FLIXO-style natural-language targets.
2. **Edit backend spike:** evaluate Diffusers pipelines for inpainting, image-to-image, and related constrained edits.
3. **Workflow abstraction spike:** compare explicit FLIXO task graphs against ComfyUI/InvokeAI workflow semantics.
4. **Visual verification spike:** define measurable checks for mask adherence, unintended-region drift, artifacts, and output integrity.
5. **Human-in-the-loop clarification:** when grounding has multiple plausible targets, the Agent should ask one targeted clarification rather than guessing.

### 9.4 Current decision

No image-generation/editing dependency is activated by this document.

The research is intended to guide the future FLIXO Visual Agent Core after the current exact-SHA RED is closed. The existing FLIXO governance remains unchanged: one capability registry, one execution gate, one verification authority, one mutation lane, and no third branch.