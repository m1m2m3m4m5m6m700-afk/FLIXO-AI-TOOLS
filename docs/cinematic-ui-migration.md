# Cinematic UI Migration

The shared tool shell now provides the first layer of the next-generation FLIXO visual system: deep dark surfaces, ambient lighting, premium HUD actions, focus-visible rings, status telemetry, and reduced-motion-safe micro-animation.

The reusable `ToolHeaderHUD` component is available for tools that need the full HUD contract (status, command palette trigger, upload/reset/export actions, and trailing controls).

## Safety contract

- Preserve existing tool processing and rendering engines.
- Preserve existing accessibility roles and test selectors.
- Keep optional callbacks optional so existing tool pages remain source-compatible.
- Prefer CSS animation for lightweight visual feedback.
- Use the shared visual vocabulary before introducing tool-specific variants.
