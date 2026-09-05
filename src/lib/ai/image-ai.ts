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
  request(request: ImageAIRequest): Promise<ImageAIResponse>;
};

export function createImageAIClient(endpoint = '/api/ai/image'): ImageAIClient {
  return {
    async request(request) {
      const body = new FormData();
      body.append('capability', request.capability);
      if (request.prompt) body.append('prompt', request.prompt);
      if (request.image) body.append('image', request.image);
      if (request.options) body.append('options', JSON.stringify(request.options));

      const response = await fetch(endpoint, { method: 'POST', body });
      if (!response.ok) {
        throw new Error(`AI image request failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.startsWith('image/')) {
        return { image: await response.blob(), mimeType: contentType };
      }

      return (await response.json()) as ImageAIResponse;
    },
  };
}
