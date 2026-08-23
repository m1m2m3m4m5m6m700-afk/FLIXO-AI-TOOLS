type TranscriptionResult = {
  text?: string;
  chunks?: ReadonlyArray<{
    text?: string;
    timestamp?: readonly [number | null, number | null];
  }>;
};

type WhisperTranscriber = (
  input: Float32Array,
  options: {
    sampling_rate: number;
    return_timestamps: boolean;
    chunk_length_s: number;
    stride_length_s: number;
  },
) => Promise<TranscriptionResult>;

type WhisperPipelineFactory = (
  task: 'automatic-speech-recognition',
  model: string,
  options?: Record<string, unknown>,
) => Promise<WhisperTranscriber>;

type WhisperModule = {
  pipeline: WhisperPipelineFactory;
};

export type CaptionWorkerRequest = { jobId: string; file: ArrayBuffer; device: 'webgpu' | 'wasm' };

const scope = globalThis as typeof globalThis & {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<CaptionWorkerRequest>) => void) | null;
};

const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1';
const MODEL = 'onnx-community/whisper-tiny';
let transcriberPromise: Promise<WhisperTranscriber> | null = null;

async function loadTranscriber(device: 'webgpu' | 'wasm') {
  if (!transcriberPromise) {
    transcriberPromise = import(/* @vite-ignore */ MODULE_URL).then((module: unknown) => {
      const runtimeModule = module as WhisperModule;
      return runtimeModule.pipeline('automatic-speech-recognition', MODEL, {
        device,
        dtype: device === 'webgpu' ? 'q4' : 'q8',
      });
    });
  }
  return transcriberPromise;
}

async function decodeAudio(buffer: ArrayBuffer) {
  const AudioCtx = globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API is unavailable');
  const context = new AudioCtx();
  try {
    const audio = await context.decodeAudioData(buffer.slice(0));
    const mono = new Float32Array(audio.length);
    for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
      const data = audio.getChannelData(channel);
      for (let i = 0; i < audio.length; i += 1) mono[i] += data[i] / audio.numberOfChannels;
    }
    return { samples: mono, sampleRate: audio.sampleRate, duration: audio.duration };
  } finally {
    await context.close();
  }
}

scope.onmessage = async ({ data }) => {
  try {
    scope.postMessage({ type: 'status', jobId: data.jobId, message: 'Decoding audio locally…' });
    const audio = await decodeAudio(data.file);
    if (audio.duration > 600) throw new Error('Video duration is limited to 10 minutes for local transcription.');
    const transcriber = await loadTranscriber(data.device);
    scope.postMessage({ type: 'status', jobId: data.jobId, message: 'Loading Whisper model locally…' });
    const result = await transcriber(audio.samples, { sampling_rate: audio.sampleRate, return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
    scope.postMessage({ type: 'done', jobId: data.jobId, result });
  } catch (error) {
    scope.postMessage({ type: 'error', jobId: data.jobId, message: error instanceof Error ? error.message : String(error) });
  }
};
