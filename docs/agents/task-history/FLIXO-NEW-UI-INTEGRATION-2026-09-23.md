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


## Official Manual Tool Sidebar Upgrade — current execution d8dc458e19aa9ccfbf568b6db3c291d67e5c232f

The uploaded `flixo-tool-template (1).html` is the visual source of truth for the shared manual-tool shell.

Implemented in `src/components/image-tool/ToolWorkbench.tsx` and `ToolWorkbench.css`:
- Official left source sidebar with upload, presets, layers/state.
- Central Compare / Before / After canvas.
- Official notebook strip for multiple open files with active-file selection and removal.
- Official right adjustment sidebar with collapsible adjustment group and active preset state.
- Mobile source/adjustment switching.
- Existing tool executors, ImageJob, safety validation, parameter schemas, output contracts, verifier behavior, download/export semantics, and legacy accessibility selectors remain authoritative.
- Language switch remains in the top bar and navigates to the same tool under the selected FLIXO locale.
- No direct main mutation and no third branch.

Coverage note:
The shared ToolWorkbench currently powers the manual image tools already migrated to that common workbench. Custom tool surfaces outside the shared workbench are not silently claimed as migrated; they require the same shell migration through their existing component contracts.
