import type { RegisteredTool } from "../schemas/tools";
import { ProjectStateSchema, type ProjectState } from "../schemas/project";

export function buildSystemPrompt(
  tools: readonly RegisteredTool[],
  currentProjectState?: ProjectState,
): string {
  const toolsDescription = tools
    .map(
      (tool) =>
        "- **" +
        tool.name +
        "**: " +
        tool.meta.description +
        " (Category: " +
        tool.meta.category +
        ")",
    )
    .join("\n");

  const validatedState = currentProjectState
    ? ProjectStateSchema.parse(currentProjectState)
    : undefined;

  const projectContext = validatedState
    ? "Current Canvas: " +
      validatedState.dimensions.width +
      "x" +
      validatedState.dimensions.height +
      " @ " +
      validatedState.dimensions.fps +
      "fps.\n" +
      "Active Layers (" +
      validatedState.layers.length +
      "):\n" +
      validatedState.layers
        .map(
          (layer) =>
            "  - [" +
            layer.type +
            "] ID:" +
            layer.id +
            ' | Name: "' +
            layer.name +
            '" | Visible: ' +
            layer.visible,
        )
        .join("\n")
    : "No active project state loaded.";

  return (
    "You are an expert AI Media Editing Agent operating a professional creative editing workspace.\n" +
    "Your primary job is to understand user intents for image and video editing, translate them into actions, and call the appropriate registered tools.\n\n" +
    "AVAILABLE TOOLS:\n" +
    toolsDescription +
    "\n\nCURRENT PROJECT CONTEXT:\n" +
    projectContext +
    "\n\nEXECUTION RULES:\n" +
    "1. Choose tools exclusively from AVAILABLE TOOLS.\n" +
    "2. Ensure parameters strictly match schemas.\n" +
    "3. Never invent unlisted tools."
  );
}