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
  lastFailureAt: number | null;
};

function defaultProviderHealth(): ProviderHealth {
  return {
    failureCount: 0,
    latencyMs: 250,
    unhealthyUntil: 0,
    lastFailureAt: null,
  };
}

const MAX_PROVIDER_ATTEMPTS = 3;
const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function rankHealth(health: ProviderHealth, now: number): number {
  const cooldownPenalty = health.unhealthyUntil > now ? 1_000_000 : 0;
  return cooldownPenalty + health.failureCount * 5_000 + health.latencyMs;
}

function isCooling(health: ProviderHealth, now: number): boolean {
  return health.unhealthyUntil > now;
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
        lastFailureAt: null,
      };
      const healthB = this.health.get(b.name) ?? defaultProviderHealth();
      return rankHealth(healthA, now) - rankHealth(healthB, now);
    });

    const available = ordered.filter((provider) => {
      const health = this.health.get(provider.name);
      return !health || !isCooling(health, now);
    });

    if (available.length === 0) {
      throw new LLMUnavailableError(
        "All configured LLM providers are currently cooling down.",
      );
    }

    let committedText = "";
    let lastError: unknown = undefined;
    let attempts = 0;

    for (const provider of available) {
      if (attempts >= MAX_PROVIDER_ATTEMPTS) break;
      if (request.signal?.aborted) return;

      attempts += 1;
      const startedAt = Date.now();
      const health = this.health.get(provider.name) ?? defaultProviderHealth();

      try {
        let sawTerminalEvent = false;

        const providerRequest: LLMStreamRequest = {
          ...request,
          model: provider.model,
          systemPrompt: request.systemPrompt,
          messages: request.resumePrefix
            ? [
                ...request.messages,
                { role: "assistant", content: request.resumePrefix.slice(-2048) },
              ]
            : request.messages,
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
        health.lastFailureAt = Date.now();
        if (health.failureCount >= FAILURE_THRESHOLD) {
          health.unhealthyUntil = Date.now() + COOLDOWN_MS;
        }
        this.health.set(provider.name, health);

        const safeReason =
          error instanceof LLMProviderError
            ? `provider failure status=${error.status ?? "unknown"}`
            : "streaming failure";
        console.warn(`[FLIXO_LLM_FAILOVER] ${provider.name}: ${safeReason}`);

        request = {
          ...request,
          resumePrefix: committedText.slice(-2048),
        };

        if (health.unhealthyUntil > Date.now()) {
          const remaining = available.some(
            (candidate) =>
              candidate !== provider &&
              !isCooling(
                this.health.get(candidate.name) ?? defaultProviderHealth(),
                Date.now(),
              ),
          );
          if (!remaining) {
            throw new LLMUnavailableError(
              "All configured LLM providers are currently cooling down.",
            );
          }
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
