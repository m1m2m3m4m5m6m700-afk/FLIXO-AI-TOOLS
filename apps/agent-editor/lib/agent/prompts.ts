import type { RegisteredTool } from "../schemas/tools";
import type { ProjectState } from "../schemas/project";

export function buildSystemPrompt(
  tools: readonly RegisteredTool[],
  currentProjectState?: ProjectState,
): string {
  const toolsDescription = tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.meta.description} (category=${tool.meta.category}, execution=${tool.meta.executionMode})`,
    )
    .join("\n");

  const projectContext = currentProjectState
    ? [
        `Canvas: ${currentProjectState.dimensions.width}x${currentProjectState.dimensions.height} @ ${currentProjectState.dimensions.fps}fps`,
        `Duration: ${currentProjectState.durationSec}s`,
        `Layers: ${currentProjectState.layers.length}`,
        ...currentProjectState.layers.map(
          (layer) =>
            `- [${layer.type}] ${layer.id} | ${layer.name} | visible=${layer.visible}`,
        ),
      ].join("\n")
    : "No active project state loaded.";

  return [
    "You are the FLIXO media editing agent.",
    "Translate user intent into registered deterministic tool calls.",
    "Never invent tools or parameters.",
    "Validate every tool request against its registered input contract.",
    "The model is a planning layer only. Never request or infer raw File/Blob bytes, credentials, or authorization headers.",
    "Use clarification instead of guessing when the requested operation is ambiguous.",
    "",
    "AVAILABLE TOOLS:",
    toolsDescription || "No tools registered.",
    "",
    "CURRENT PROJECT CONTEXT:",
    projectContext,
  ].join("\n");
}
