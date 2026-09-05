export type VideoOutputFormat = 'mp4' | 'webm' | 'gif';
export type VideoQuality = 'high' | 'balanced' | 'small';

export function normalizeVideoFormat(value: string): VideoOutputFormat {
  return value === 'mp4' || value === 'gif' ? value : 'webm';
}

export function normalizeVideoQuality(value: string): VideoQuality {
  return value === 'high' || value === 'small' ? value : 'balanced';
}

export function buildFfmpegArguments(inputName: string, outputName: string, format: VideoOutputFormat, quality: VideoQuality): string[] {
  const args = ['-i', inputName];
  if (format === 'gif') {
    const fps = quality === 'high' ? '12' : quality === 'small' ? '6' : '8';
    const width = quality === 'high' ? '720' : quality === 'small' ? '360' : '480';
    args.push('-vf', `fps=${fps},scale=${width}:-1:flags=lanczos`, '-an', outputName);
    return args;
  }
  if (format === 'mp4') {
    const crf = quality === 'high' ? '20' : quality === 'small' ? '30' : '25';
    args.push('-c:v', 'libx264', '-crf', crf, '-preset', 'veryfast', '-c:a', 'aac', '-b:a', quality === 'small' ? '96k' : '128k', outputName);
    return args;
  }
  const crf = quality === 'high' ? '24' : quality === 'small' ? '34' : '29';
  args.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0', '-c:a', 'libopus', '-b:a', quality === 'small' ? '80k' : '112k', outputName);
  return args;
}

export function getOutputMimeType(format: VideoOutputFormat): string {
  return format === 'gif' ? 'image/gif' : format === 'mp4' ? 'video/mp4' : 'video/webm';
}

export function makeOutputFilename(inputName: string, format: VideoOutputFormat): string {
  const stem = inputName.replace(/\.[^/.]+$/, '') || 'flixo-video';
  return `${stem}-compressed.${format}`;
}

export function calculateSavings(before: number, after: number): number {
  if (before <= 0 || after < 0) return 0;
  return Math.max(0, ((before - after) / before) * 100);
}
