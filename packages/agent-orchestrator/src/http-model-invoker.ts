import { ModelProviderClient, type ModelProvider } from "@flixo/agent-runtime";
import type { AgentModelInvoker, AgentModelRequest, AgentModelResponse } from "./model-adapter.ts";

export type SupportedAgentProvider = ModelProvider;

export type HttpAgentModelInvokerOptions = Readonly<{
  provider: SupportedAgentProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxTokens?: number;
}>;

export class HttpAgentModelInvoker implements AgentModelInvoker {
  private readonly client: ModelProviderClient;

  constructor(options: HttpAgentModelInvokerOptions) {
    this.client = new ModelProviderClient(options);
  }

  async invoke(request: AgentModelRequest): Promise<AgentModelResponse> {
    const content = await this.client.complete(request.messages);
    return Object.freeze({ content });
  }
}
