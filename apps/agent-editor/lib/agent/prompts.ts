import { RegisteredToolSchema, type RegisteredTool } from "../schemas/tools";
import { ProjectStateSchema, type ProjectState } from "../schemas/project";

export function buildSystemPrompt(
  tools: readonly RegisteredTool[],
  currentProjectState?: ProjectState,
): string {
  const validatedTools = tools.map((tool) => RegisteredToolSchema.parse(tool));
  const toolsDescription = validatedTools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.meta.description} (category=${tool.meta.category}, execution=${tool.meta.executionMode})`,
    )
    .join("\n");

  const validatedState = currentProjectState
    ? ProjectStateSchema.parse(currentProjectState)
    : undefined;

  const projectContext = validatedState
    ? [
        `Canvas: ${validatedState.dimensions.width}x${validatedState.dimensions.height} @ ${validatedState.dimensions.fps}fps`,
        `Duration: ${validatedState.durationSec}s`,
        `Layers: ${validatedState.layers.length}`,
        ...validatedState.layers.map(
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
