import { applyNoiseReduction, type NoiseReductionOptions } from './engine';

type Request = { channels: Float32Array[]; options: NoiseReductionOptions };
type Response = { channels: Float32Array[] } | { error: string };

const scope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = ({ data }: MessageEvent<Request>) => {
  try {
    const channels: Float32Array[] = data.channels.map((channel: Float32Array) => applyNoiseReduction(channel, data.options));
    const transfer: ArrayBuffer[] = channels.map((channel: Float32Array) => channel.buffer as ArrayBuffer);
    scope.postMessage({ channels }, transfer);
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : 'Noise reduction failed.' });
  }
};
