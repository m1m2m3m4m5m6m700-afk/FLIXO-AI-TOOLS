export type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
};

export type ClipRange = {
  start: number;
  end: number;
};

export function clampRange(range: ClipRange, duration: number): ClipRange {
  const safeDuration = Math.max(0, duration);
  const start = Math.min(Math.max(0, range.start), safeDuration);
  const end = Math.min(Math.max(start, range.end), safeDuration);
  return { start, end };
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function getSupportedRecordingMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
      const width = Number.isFinite(video.videoWidth) ? video.videoWidth : 0;
      const height = Number.isFinite(video.videoHeight) ? video.videoHeight : 0;
      cleanup();
      if (!duration || !width || !height) {
        reject(new Error('Unable to read video metadata'));
        return;
      }
      resolve({ duration, width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Unable to load video'));
    };
    video.src = url;
  });
}

export async function exportClip(file: File, requestedRange: ClipRange): Promise<Blob> {
  const mimeType = getSupportedRecordingMimeType();
  if (!mimeType) throw new Error('This browser cannot export WebM video locally');
  if (typeof HTMLVideoElement === 'undefined') throw new Error('Video APIs are unavailable');

  const metadata = await getVideoMetadata(file);
  const range = clampRange(requestedRange, metadata.duration);
  if (range.end <= range.start) throw new Error('End time must be greater than start time');

  const video = document.createElement('video');
  const sourceUrl = URL.createObjectURL(file);
  video.src = sourceUrl;
  video.preload = 'auto';
  video.muted = false;
  video.playsInline = true;
  video.controls = false;

  if (typeof video.captureStream !== 'function') {
    URL.revokeObjectURL(sourceUrl);
    throw new Error('Video capture is not supported by this browser');
  }

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Unable to load source video'));
  });

  video.currentTime = range.start;
  await new Promise<void>((resolve) => {
    const ready = () => {
      video.removeEventListener('seeked', ready);
      resolve();
    };
    video.addEventListener('seeked', ready, { once: true });
  });

  const stream = video.captureStream();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  const output = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error('Video recording failed'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const stopAtEnd = () => {
    if (video.currentTime >= range.end || video.ended) {
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
    }
  };

  video.addEventListener('timeupdate', stopAtEnd);
  video.addEventListener('ended', stopAtEnd);
  recorder.start(250);

  try {
    await video.play();
  } catch {
    recorder.stop();
    URL.revokeObjectURL(sourceUrl);
    throw new Error('Browser blocked local video playback');
  }

  try {
    const result = await output;
    return result;
  } finally {
    video.pause();
    stream.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(sourceUrl);
  }
}
