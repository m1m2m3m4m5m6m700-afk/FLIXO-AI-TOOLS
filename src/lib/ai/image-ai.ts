import { ImageAIResponseSchema } from '../runtime-boundaries.ts';

export type ImageAICapability =
  | 'analyze-image'
  | 'generate-image'
  | 'remove-background'
  | 'remove-object'
  | 'upscale-image'
  | 'generate-alt-text';

export type ImageAIRequest = {
  capability: ImageAICapability;
  image?: File;
  prompt?: string;
  options?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
};

export type ImageAIResponse = {
  requestId?: string;
  mimeType?: string;
  image?: Blob;
  text?: string;
  metadata?: Record<string, unknown>;
};

export type ImageAIClient = {
  request(request: ImageAIRequest): Promise<ImageAIResponse>;
};

const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const MAX_PROMPT_BYTES = 32 * 1024;
const MAX_OPTIONS_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function composeTimeoutSignal(signal: AbortSignal | undefined): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('AI request timed out.', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function parseContentLength(response: Response): number | undefined {
  const value = response.headers.get('content-length');
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function createImageAIClient(endpoint = '/api/ai/image'): ImageAIClient {
  return {
    async request(request) {
      const prompt = request.prompt?.trim() ?? '';
      const optionsJson = request.options ? JSON.stringify(request.options) : '';
      const payloadBytes = (request.image?.size ?? 0) + byteLength(prompt) + byteLength(optionsJson);
      if (payloadBytes > MAX_REQUEST_BYTES) throw new Error('AI image request payload exceeds the maximum allowed size.');
      if (byteLength(prompt) > MAX_PROMPT_BYTES) throw new Error('AI image prompt exceeds the maximum allowed size.');
      if (byteLength(optionsJson) > MAX_OPTIONS_BYTES) throw new Error('AI image options exceed the maximum allowed size.');

      const body = new FormData();
      body.append('capability', request.capability);
      if (prompt) body.append('prompt', prompt);
      if (request.image) body.append('image', request.image);
      if (optionsJson) body.append('options', optionsJson);

      const timeout = composeTimeoutSignal(request.signal);
      try {
        const response = await fetch(endpoint, { method: 'POST', body, signal: timeout.signal });
        if (!response.ok) throw new Error(`AI image request failed: ${response.status}`);

        const declaredLength = parseContentLength(response);
        if (declaredLength !== undefined && declaredLength > MAX_RESPONSE_BYTES) {
          throw new Error('AI image response exceeds the maximum allowed size.');
        }

        const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
        if (contentType.startsWith('image/')) {
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('AI image response exceeds the maximum allowed size.');
          return { image: new Blob([bytes], { type: contentType }), mimeType: contentType };
        }

        if (!contentType.includes('json')) throw new Error(`Unsupported AI image response content type: ${contentType || 'unknown'}`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('AI image response exceeds the maximum allowed size.');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return ImageAIResponseSchema.parse(JSON.parse(text));
      } finally {
        timeout.dispose();
      }
    },
  };
}
