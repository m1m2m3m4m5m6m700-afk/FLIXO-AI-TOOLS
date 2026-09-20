import { useEffect, useRef, useState } from 'react';

export function FilterMaskTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
    } catch {
      setError('Camera access was denied or unavailable.');
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }

  return (
    <section>
      <h2>Filter Mask</h2>
      <button type="button" onClick={() => void start()} disabled={running}>Start camera</button>
      <button type="button" onClick={stop} disabled={!running}>Stop camera</button>
      {error && <p role="alert">{error}</p>}
      <video ref={videoRef} playsInline muted />
    </section>
  );
}
