export type StructuredAgentError = Readonly<{
  code: string;
  recoverable: boolean;
  retryable: boolean;
  suggestedAction: string;
  capabilityId?: string;
  executionId?: string;
  provider?: string;
}>;

export function createStructuredAgentError(input: StructuredAgentError): StructuredAgentError {
  return Object.freeze({ ...input });
}

export function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:timed out|returned HTTP (?:408|409|425|429|500|502|503|504)|temporarily unavailable|network|fetch failed)/iu.test(message);
}
