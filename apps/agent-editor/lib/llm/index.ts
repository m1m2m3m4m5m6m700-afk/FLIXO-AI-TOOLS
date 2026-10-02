import { getProviderApiKey, getProviderModel } from "./credentials";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { LLMRouter } from "./router";
import { findRegisteredModel } from "../../../../src/lib/agent/model-registry";
import { isProductionEligible } from "../../../../src/lib/agent/model-governance";
import type { LLMProvider, LLMProviderName, LLMToolDefinition } from "./types";
import type { CanonicalAgentTool } from "../tools/canonical";

const PROVIDER_ORDER: readonly LLMProviderName[] = ["openai", "anthropic", "gemini"];
const DEFAULT_OMNIROUTE_BASE_URL = "http://127.0.0.1:20128/v1";

function isAdmittedAgentModel(provider: LLMProviderName, model: string): boolean {
  const entry = findRegisteredModel(model);
  if (!entry || entry.provider !== provider) return false;
  if (!isProductionEligible(entry)) return false;

  return entry.supported_tasks.some((task) =>
    task === "CHAT"
    || task === "UNDERSTAND"
    || task === "PLAN"
    || task === "EXECUTION_PLANNING"
  );
}

function isAdmittedOmniRouteModel(model: string): boolean {
  if (model === "auto") return process.env.NODE_ENV !== "production";
  const entry = findRegisteredModel(model);
  if (!entry || !isProductionEligible(entry)) return false;
  return entry.supported_tasks.some((task) =>
    task === "CHAT"
    || task === "UNDERSTAND"
    || task === "PLAN"
    || task === "EXECUTION_PLANNING"
  );
}

export function createDefaultLLMRouter(): LLMRouter {
  const providers: LLMProvider[] = [];

  for (const name of PROVIDER_ORDER) {
    const key = getProviderApiKey(name);
    const model = getProviderModel(name);
    if (!key || !model || !isAdmittedAgentModel(name, model)) continue;

    if (name === "openai") providers.push(new OpenAIProvider(model, key));
    else if (name === "anthropic") providers.push(new AnthropicProvider(model, key));
    else providers.push(new GeminiProvider(model, key));
  }

  if (process.env.FLIXO_OMNIROUTE_ENABLED === "true") {
    const model = process.env.FLIXO_LLM_OMNIROUTE_MODEL?.trim();
    const baseUrl = process.env.FLIXO_OMNIROUTE_BASE_URL?.trim() || DEFAULT_OMNIROUTE_BASE_URL;
    const apiKey = process.env.FLIXO_OMNIROUTE_API_KEY?.trim() || "";
    if (model && isAdmittedOmniRouteModel(model)) {
      providers.push(new OpenAIProvider(model, apiKey, `${baseUrl.replace(/\/+$/, "")}/chat/completions`, "omniroute", false));
    } else if (model) {
      console.warn("[FLIXO_OMNIROUTE_CONFIG] model not admitted; provider disabled.");
    }
  }

  return new LLMRouter(providers);
}

export function toLLMTools(tools: readonly CanonicalAgentTool[]): LLMToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.id,
    description: tool.description,
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
export { LLMUnavailableError } from "./types";
export { LLMRouter } from "./router";
