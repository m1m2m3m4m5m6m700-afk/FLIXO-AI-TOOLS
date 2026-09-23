# FLIXO NEW UI INTEGRATION — 2026-09-23

Task: begin integration of the new FLIXO landing/agent/tool visual system with the existing production execution system.

Scope implemented on execution:
- Official FLIXO agent studio shell mounted by src/components/FlixoAIAgent.tsx.
- Existing conversation memory, intent planning, canonical execution confirmation, execution pipeline, result verification, Filter Mask handoff, and save-result path preserved.
- Official tool-page shell integrated into src/components/image-tool/ToolWorkbench.tsx.
- Existing ImageJob, asset store, input safety, parameter schemas, output contracts, verifiers, executors, download semantics, and batch footer preserved.
- Legacy workbench selectors and accessibility semantics preserved for existing Playwright coverage:
  .image-tool-shell
  .image-workbench-grid
  .image-workbench-preview
  .image-workbench-output
  aria-busy
  aria-disabled
  img[alt="Tool result"]
  downloadRole behavior
- New UI assets were added as reusable React/CSS components rather than keeping standalone HTML as the runtime surface.
- No main mutation. No third branch.

Source references supplied for this wave:
- flixo-agent-ui.html — official agent studio visual reference.
- flixo-tool-template.html — official tool-page visual reference.
- flixo-landing.html — landing visual reference retained for the next integration phase.

Authority:
UI is presentation only. Existing canonical registry, execution gate, output contracts, verification, security, and CI remain authoritative.
