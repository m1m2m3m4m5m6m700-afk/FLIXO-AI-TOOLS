import { z } from 'zod';

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
};

export type ImageAIResponse = {
  requestId?: string;
  mimeType?: string;
  image?: Blob;
  text?: string;
  metadata?: Record<string, unknown>;
};

export type ImageAIClient = {
  request(request: ImageAIRequest, signal: AbortSignal): Promise<ImageAIResponse>;
};

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const imageAIJsonSchema = z.object({
  requestId: z.string().max(256).optional(),
  mimeType: z.string().max(128).optional(),
  text: z.string().max(MAX_JSON_BYTES).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

function composeSignal(signal: AbortSignal, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('AI request timed out.', 'TimeoutError')), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
  return { signal: controller.signal, cleanup: () => { clearTimeout(timeout); signal.removeEventListener('abort', onAbort); } };
}

export function createImageAIClient(endpoint = '/api/ai/image'): ImageAIClient {
  return {
    async request(request, signal) {
      if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      const body = new FormData();
      body.append('capability', request.capability);
      if (request.prompt) body.append('prompt', request.prompt);
      if (request.image) body.append('image', request.image);
      if (request.options) body.append('options', JSON.stringify(request.options));

      const composed = composeSignal(signal, 30_000);
      try {
        const response = await fetch(endpoint, { method: 'POST', body, signal: composed.signal });
        if (!response.ok) throw new Error(`AI image request failed: ${response.status}`);
        const contentType = response.headers.get('content-type') ?? '';
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        if (contentLength > MAX_IMAGE_BYTES && contentType.startsWith('image/')) throw new Error('AI image response exceeds the payload limit.');
        if (contentType.startsWith('image/')) {
          const image = await response.blob();
          if (image.size > MAX_IMAGE_BYTES) throw new Error('AI image response exceeds the payload limit.');
          return { image, mimeType: contentType };
        }

        if (contentLength > MAX_JSON_BYTES) throw new Error('AI response exceeds the payload limit.');
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error('AI response exceeds the payload limit.');
        const parsed = imageAIJsonSchema.parse(JSON.parse(text));
        return parsed;
      } finally {
        composed.cleanup();
      }
    },
  };
}
