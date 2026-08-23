import { applyNoiseReduction, type NoiseReductionOptions } from './engine';

type Request = { channels: Float32Array[]; options: NoiseReductionOptions };
type Response = { channels: Float32Array[] } | { error: string };

const scope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = ({ data }) => {
  try {
    const channels = data.channels.map((channel) => applyNoiseReduction(channel, data.options));
    const transfer = channels.map((channel) => channel.buffer as ArrayBuffer);
    scope.postMessage({ channels }, transfer);
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : 'Noise reduction failed.' });
  }
};
