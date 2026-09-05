export type AudioAction = 'extract' | 'mute';

export function clampDurationRange(start: number, end: number, duration: number) {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const safeStart = Math.min(Math.max(0, Number.isFinite(start) ? start : 0), safeDuration);
  const safeEnd = Math.min(Math.max(safeStart, Number.isFinite(end) ? end : safeDuration), safeDuration);
  return { start: safeStart, end: safeEnd };
}

export function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function pickMuteMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export async function getMediaMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const result = {
        duration: Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0,
        width: Number.isFinite(video.videoWidth) ? video.videoWidth : 0,
        height: Number.isFinite(video.videoHeight) ? video.videoHeight : 0,
      };
      cleanup();
      if (!result.duration) reject(new Error('Unable to read video metadata'));
      else resolve(result);
    };
    video.onerror = () => { cleanup(); reject(new Error('Unable to load video')); };
    video.src = url;
  });
}

async function loadVideo(file: File) {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.src = url;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Unable to load source video'));
  });
  return { video, url };
}

export async function processVideo(file: File, action: AudioAction, start = 0, end?: number): Promise<Blob> {
  if (typeof HTMLVideoElement === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Required browser media APIs are unavailable');
  }

  const metadata = await getMediaMetadata(file);
  const range = clampDurationRange(start, end ?? metadata.duration, metadata.duration);
  if (range.end <= range.start) throw new Error('End time must be greater than start time');

  const videoResult = await loadVideo(file);
  const { video, url } = videoResult;
  const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
  if (typeof capture !== 'function') {
    URL.revokeObjectURL(url);
    throw new Error('Video capture is not supported by this browser');
  }

  video.currentTime = range.start;
  await new Promise<void>((resolve) => video.addEventListener('seeked', () => resolve(), { once: true }));

  const sourceStream = capture.call(video);
  const mimeType = action === 'extract' ? pickAudioMimeType() : pickMuteMimeType();
  if (!mimeType) {
    sourceStream.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(url);
    throw new Error(`This browser cannot export ${action === 'extract' ? 'audio' : 'muted video'} locally`);
  }

  const tracks = action === 'extract' ? sourceStream.getAudioTracks() : sourceStream.getVideoTracks();
  if (tracks.length === 0) {
    sourceStream.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(url);
    throw new Error(action === 'extract' ? 'No audio track found in this video' : 'No video track found in this file');
  }

  const outputStream = new MediaStream(tracks);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(outputStream, { mimeType });
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error('Media recording failed'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const stopWhenReady = () => {
    if (video.currentTime >= range.end || video.ended) {
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
    }
  };
  video.addEventListener('timeupdate', stopWhenReady);
  video.addEventListener('ended', stopWhenReady);
  recorder.start(250);

  try {
    await video.play();
    const result = await finished;
    return result;
  } finally {
    video.pause();
    outputStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    sourceStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    URL.revokeObjectURL(url);
  }
}
