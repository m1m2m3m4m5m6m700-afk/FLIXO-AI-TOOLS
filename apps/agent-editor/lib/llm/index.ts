import { getProviderApiKey, getProviderModel } from "./credentials";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { LLMRouter } from "./router";
import type { LLMProviderName, LLMToolDefinition } from "./types";

const PROVIDER_ORDER: readonly LLMProviderName[] = ["openai", "anthropic", "gemini"];

export function createDefaultLLMRouter(): LLMRouter {
  const providers = PROVIDER_ORDER.flatMap((name) => {
    const key = getProviderApiKey(name);
    const model = getProviderModel(name);
    if (!key || !model) return [];

    if (name === "openai") return [new OpenAIProvider(model, key)];
    if (name === "anthropic") return [new AnthropicProvider(model, key)];
    return [new GeminiProvider(model, key)];
  });

  return new LLMRouter(providers);
}

export function toLLMTools(
  tools: readonly {
    name: string;
    meta: { description: string };
    jsonSchemaInput: Record<string, unknown>;
  }[],
): LLMToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.meta.description,
    parameters: tool.jsonSchemaInput,
  }));
}

export type {
  LLMMessage,
  LLMProvider,
  LLMProviderError,
  LLMStreamEvent,
  LLMStreamRequest,
  LLMToolCall,
  LLMToolDefinition,
  LLMToolResult,
  LLMProviderName,
} from "./types";
export {
  LLMUnavailableError,
} from "./types";
export { LLMRouter } from "./router";
