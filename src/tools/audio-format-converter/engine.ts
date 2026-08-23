export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a' | 'aac';
export type AudioQuality = 'high' | 'balanced' | 'small';

const FORMAT_MIME: Record<AudioFormat, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
};

export function normalizeFormat(value: string): AudioFormat {
  return (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] as const).includes(value as AudioFormat) ? value as AudioFormat : 'mp3';
}
export function normalizeQuality(value: string): AudioQuality {
  return (['high', 'balanced', 'small'] as const).includes(value as AudioQuality) ? value as AudioQuality : 'balanced';
}
export function getMime(format: AudioFormat): string { return FORMAT_MIME[format]; }
export function getBitrate(quality: AudioQuality): string { return quality === 'high' ? '256k' : quality === 'small' ? '96k' : '160k'; }
export function getOutputName(inputName: string, format: AudioFormat): string { return `${inputName.replace(/\.[^.]+$/, '')}.${format}`; }
export function buildArgs(input: string, output: string, format: AudioFormat, quality: AudioQuality): string[] {
  const bitrate = getBitrate(quality); const args = ['-i', input];
  switch (format) {
    case 'mp3': return [...args, '-vn', '-codec:a', 'libmp3lame', '-b:a', bitrate, output];
    case 'wav': return [...args, '-vn', '-codec:a', 'pcm_s16le', output];
    case 'ogg': return [...args, '-vn', '-codec:a', 'libvorbis', '-b:a', bitrate, output];
    case 'flac': return [...args, '-vn', '-codec:a', 'flac', output];
    case 'm4a': return [...args, '-vn', '-codec:a', 'aac', '-b:a', bitrate, output];
    case 'aac': return [...args, '-vn', '-codec:a', 'aac', '-b:a', bitrate, '-f', 'adts', output];
  }
}
export function calculateSavings(inputSize: number, outputSize: number): number { return inputSize > 0 ? ((inputSize - outputSize) / inputSize) * 100 : 0; }
