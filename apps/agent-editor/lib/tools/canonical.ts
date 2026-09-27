import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CAPABILITY_DEFINITIONS,
  validateCapabilityParameters,
} from "../../../../src/lib/agent/capability-registry";

export type CanonicalAgentTool = Readonly<{
  id: string;
  name: string;
  description: string;
  category: "Images" | "Video";
  jsonSchemaInput: Record<string, unknown>;
  parameterSchema: (typeof CAPABILITY_DEFINITIONS)[number]["parameterSchema"];
  executionMode: "LOCAL";
  executorId: string;
  maxPixels: number;
  maxFileSizeBytes: number;
  outputContractId: string;
}>;

function toJsonSchema(
  schema: (typeof CAPABILITY_DEFINITIONS)[number]["parameterSchema"],
): Record<string, unknown> {
  const value = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
  delete value.$schema;
  return value;
}

export const CANONICAL_AGENT_TOOLS: readonly CanonicalAgentTool[] =
  Object.freeze(
    CAPABILITY_DEFINITIONS.map((tool) =>
      Object.freeze({
        id: tool.id,
        name: tool.id,
        description: tool.description,
        category: tool.category,
        jsonSchemaInput: toJsonSchema(tool.parameterSchema),
        parameterSchema: tool.parameterSchema,
        executionMode: tool.executionMode,
        executorId: tool.operational.executorId,
        maxPixels: tool.safetyLimits.maxPixels,
        maxFileSizeBytes: tool.safetyLimits.maxFileSizeBytes,
        outputContractId: tool.operational.outputContractId,
      }),
    ),
  );

export function getCanonicalAgentTool(
  id: string,
): CanonicalAgentTool | undefined {
  return CANONICAL_AGENT_TOOLS.find((tool) => tool.id === id);
}

export function validateCanonicalAgentParameters(
  toolName: string,
  parameters: unknown,
) {
  if (!getCanonicalAgentTool(toolName)) {
    throw new Error(`CANONICAL_TOOL_NOT_EXECUTABLE:${toolName}`);
  }
  return validateCapabilityParameters(toolName, parameters);
}
