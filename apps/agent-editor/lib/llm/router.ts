import {
  dedupeStreamingText,
} from "./sse";
import {
  LLMProviderError,
  LLMUnavailableError,
  type LLMProvider,
  type LLMStreamEvent,
  type LLMStreamRequest,
} from "./types";

type ProviderHealth = {
  failureCount: number;
  latencyMs: number;
  unhealthyUntil: number;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function rankHealth(health: ProviderHealth, now: number): number {
  const cooldownPenalty = health.unhealthyUntil > now ? 1_000_000 : 0;
  return cooldownPenalty + health.failureCount * 5_000 + health.latencyMs;
}

export class LLMRouter {
  private readonly health = new Map<string, ProviderHealth>();

  constructor(private readonly providers: readonly LLMProvider[]) {}

  configuredProviders(): readonly LLMProvider[] {
    return this.providers.filter((provider) => provider.isConfigured());
  }

  async *stream(request: LLMStreamRequest): AsyncGenerator<LLMStreamEvent> {
    const configured = this.configuredProviders();
    if (configured.length === 0) {
      throw new LLMUnavailableError();
    }

    const now = Date.now();
    const ordered = [...configured].sort((a, b) => {
      const healthA = this.health.get(a.name) ?? {
        failureCount: 0,
        latencyMs: 250,
        unhealthyUntil: 0,
      };
      const healthB = this.health.get(b.name) ?? {
        failureCount: 0,
        latencyMs: 250,
        unhealthyUntil: 0,
      };
      return rankHealth(healthA, now) - rankHealth(healthB, now);
    });

    let committedText = "";
    let lastError: unknown = undefined;

    for (const provider of ordered) {
      if (request.signal?.aborted) return;

      const startedAt = Date.now();
      const health = this.health.get(provider.name) ?? {
        failureCount: 0,
        latencyMs: 250,
        unhealthyUntil: 0,
      };

      try {
        let sawTerminalEvent = false;

        const providerRequest: LLMStreamRequest = {
          ...request,
          model: provider.model,
          systemPrompt: request.resumePrefix
            ? [
                request.systemPrompt,
                "",
                "RESUMED RESPONSE INSTRUCTION:",
                "Continue the interrupted assistant response without repeating the already delivered text.",
                "Already delivered prefix:",
                request.resumePrefix.slice(-2048),
              ].join("\n")
            : request.systemPrompt,
        };

        for await (const event of provider.stream(providerRequest)) {
          if (event.type === "text_delta") {
            const nextText = dedupeStreamingText(committedText, event.text);
            if (nextText) {
              committedText += nextText;
              yield { type: "text_delta", text: nextText };
            }
            continue;
          }

          if (event.type === "turn_end") {
            sawTerminalEvent = true;
            health.failureCount = 0;
            health.unhealthyUntil = 0;
            health.latencyMs = Math.round(
              health.latencyMs * 0.7 + (Date.now() - startedAt) * 0.3,
            );
            this.health.set(provider.name, health);
            yield event;
          }
        }

        if (!sawTerminalEvent) {
          throw new LLMProviderError(
            provider.name,
            "Provider ended without a terminal turn event.",
            { retryable: true },
          );
        }

        return;
      } catch (error) {
        if (isAbortError(error)) throw error;

        lastError = error;
        health.failureCount += 1;
        health.unhealthyUntil =
          Date.now() + Math.min(60_000, 1_000 * 2 ** Math.min(health.failureCount, 6));
        this.health.set(provider.name, health);

        const safeReason =
          error instanceof LLMProviderError
            ? `provider failure status=${error.status ?? "unknown"}`
            : "streaming failure";
        console.warn(`[FLIXO_LLM_FAILOVER] ${provider.name}: ${safeReason}`);

        if (provider !== ordered[ordered.length - 1]) {
          request = {
            ...request,
            resumePrefix: committedText.slice(-2048),
          };
        }
      }
    }

    throw new LLMUnavailableError(
      lastError instanceof LLMProviderError
        ? "All configured LLM providers failed or became unavailable."
        : "All configured LLM providers failed during streaming.",
    );
  }
}
