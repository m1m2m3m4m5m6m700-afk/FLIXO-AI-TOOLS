export type AudioRange = { start: number; end: number };

export function clampAudioRange(start: number, end: number, duration: number): AudioRange {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const safeStart = Math.min(Math.max(0, Number.isFinite(start) ? start : 0), safeDuration);
  const safeEnd = Math.min(Math.max(safeStart, Number.isFinite(end) ? end : safeDuration), safeDuration);
  return { start: safeStart, end: safeEnd };
}

export function formatAudioTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
  return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return output;
}

export function buildWaveform(samples: Float32Array, buckets = 96): number[] {
  if (samples.length === 0) return [];
  const output = new Array<number>(buckets).fill(0);
  const bucketSize = Math.max(1, Math.floor(samples.length / buckets));
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = bucket * bucketSize;
    const end = Math.min(samples.length, start + bucketSize);
    let peak = 0;
    for (let i = start; i < end; i += 1) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
    output[bucket] = peak;
  }
  return output;
}
