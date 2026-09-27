import { getProviderApiKey, getProviderModel } from "./credentials";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { LLMRouter } from "./router";
import type { LLMProvider, LLMProviderName, LLMToolDefinition } from "./types";

const PROVIDER_ORDER: readonly LLMProviderName[] = ["openai", "anthropic", "gemini"];

export function createDefaultLLMRouter(): LLMRouter {
  const providers: LLMProvider[] = [];

  for (const name of PROVIDER_ORDER) {
    const key = getProviderApiKey(name);
    const model = getProviderModel(name);
    if (!key || !model) continue;

    if (name === "openai") {
      providers.push(new OpenAIProvider(model, key));
    } else if (name === "anthropic") {
      providers.push(new AnthropicProvider(model, key));
    } else {
      providers.push(new GeminiProvider(model, key));
    }
  }

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
