import { ToolRegistry } from "../agent/registry";
import { applyColorLutTool } from "./apply-color-lut";
import { removeBackgroundTool } from "./remove-background";
import { trimVideoTool } from "./trim-video";

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(removeBackgroundTool);
  registry.register(applyColorLutTool);
  registry.register(trimVideoTool);
  return registry;
}

export {
  applyColorLutTool,
  removeBackgroundTool,
  trimVideoTool,
};
