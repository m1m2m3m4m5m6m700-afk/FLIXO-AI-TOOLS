export type NoiseReductionOptions = { reduction: number; highPassHz: number };
export type NoiseReductionResult = { sampleRate: number; channels: Float32Array[] };

export function validateNoiseReductionOptions(options: NoiseReductionOptions): NoiseReductionOptions {
  if (!Number.isFinite(options.reduction) || options.reduction < 0 || options.reduction > 1) {
    throw new Error('Reduction must be between 0 and 1.');
  }
  if (!Number.isFinite(options.highPassHz) || options.highPassHz < 0 || options.highPassHz > 2000) {
    throw new Error('High-pass frequency must be between 0 and 2000 Hz.');
  }
  return { reduction: options.reduction, highPassHz: options.highPassHz };
}

export function applyNoiseReduction(input: Float32Array, options: NoiseReductionOptions): Float32Array {
  const { reduction } = validateNoiseReductionOptions(options);
  const output = new Float32Array(input.length);
  let envelope = 0;
  const attack = 0.02;
  const release = 0.003;
  for (let i = 0; i < input.length; i += 1) {
    const sample = input[i] ?? 0;
    const magnitude = Math.abs(sample);
    envelope = magnitude > envelope ? envelope + (magnitude - envelope) * attack : envelope + (magnitude - envelope) * release;
    const threshold = Math.max(0.002, envelope * (1 - reduction) * 0.65);
    const gain = magnitude <= threshold ? 1 - reduction * 0.92 : 1;
    output[i] = sample * gain;
  }
  return output;
}
