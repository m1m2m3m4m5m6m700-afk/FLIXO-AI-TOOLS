export type CompressionQuality = 'high' | 'balanced' | 'small';

export function normalizeQuality(value: string): CompressionQuality {
  return (['high', 'balanced', 'small'] as const).includes(value as CompressionQuality)
    ? (value as CompressionQuality)
    : 'balanced';
}

export function getTargetBitrate(quality: CompressionQuality): number {
  switch (quality) {
    case 'high': return 192_000;
    case 'small': return 64_000;
    default: return 96_000;
  }
}

export function getOutputName(inputName: string): string {
  return `${inputName.replace(/\.[^.]+$/, '')}-compressed.wav`;
}

export function calculateSavings(inputSize: number, outputSize: number): number {
  return inputSize > 0 ? ((inputSize - outputSize) / inputSize) * 100 : 0;
}
