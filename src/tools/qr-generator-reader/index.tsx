import { useRef, useState } from 'react';
import { buildQrPayload, renderQrDataUrl, renderQrSvg, scanQrFile, type QrPayloadType } from './engine';

const TYPES: Array<{ value: QrPayloadType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'url', label: 'URL' },
  { value: 'wifi', label: 'Wi-Fi (SSID|Password|Security)' },
  { value: 'vcard', label: 'vCard (name)' },
];

export function QrGeneratorReaderTool() {
  const [type, setType] = useState<QrPayloadType>('text');
  const [value, setValue] = useState('https://flixo.tools');
  const [foreground, setForeground] = useState('#111827');
  const [background, setBackground] = useState('#ffffff');
  const [preview, setPreview] = useState('');
  const [svg, setSvg] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      buildQrPayload(type, value);
      const [dataUrl, svgMarkup] = await Promise.all([
        renderQrDataUrl({ type, value, foreground, background, width: 360 }),
        renderQrSvg({ type, value, foreground, background, width: 360 }),
      ]);
      setPreview(dataUrl);
      setSvg(svgMarkup);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate QR code.');
      setPreview('');
      setSvg('');
    } finally {
      setBusy(false);
    }
  };

  const scanFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setScanResult(await scanQrFile(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to scan QR code.');
      setScanResult('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="qr-title">
      <header>
        <h1 id="qr-title" className="text-3xl font-bold">QR Code Generator &amp; Reader</h1>
        <p className="mt-2 text-sm opacity-75">Generate QR codes and scan QR images locally in your browser.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5" aria-labelledby="generator-title">
          <h2 id="generator-title" className="font-semibold">Generate</h2>
          <label className="mt-4 block text-sm font-medium" htmlFor="qr-type">Payload type</label>
          <select id="qr-type" className="mt-2 w-full rounded-xl border p-3" value={type} onChange={(event) => setType(event.target.value as QrPayloadType)}>
            {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <label className="mt-4 block text-sm font-medium" htmlFor="qr-content">Content</label>
          <textarea id="qr-content" className="mt-2 min-h-32 w-full rounded-xl border p-3" value={value} onChange={(event) => setValue(event.target.value)} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm">Foreground<input aria-label="Foreground color" className="mt-2 h-11 w-full" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></label>
            <label className="text-sm">Background<input aria-label="Background color" className="mt-2 h-11 w-full" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
          </div>
          <button type="button" className="mt-4 rounded-xl border px-4 py-2" onClick={generate} disabled={busy}>Generate QR</button>
          {preview ? <div className="mt-4 flex flex-col items-center gap-3"><img src={preview} alt="Generated QR code" className="max-w-full rounded-lg border p-2" /><a className="rounded-xl border px-4 py-2" download="flixo-qr.png" href={preview}>Download PNG</a><a className="rounded-xl border px-4 py-2" download="flixo-qr.svg" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}>Download SVG</a></div> : null}
        </section>

        <section className="rounded-2xl border p-5" aria-labelledby="reader-title">
          <h2 id="reader-title" className="font-semibold">Read QR image</h2>
          <p className="mt-2 text-sm opacity-70">Uses the browser BarcodeDetector API; no image is uploaded.</p>
          <input ref={inputRef} className="mt-4 block w-full rounded-xl border p-3" type="file" accept="image/*" onChange={(event) => { void scanFile(event.target.files?.[0]); }} />
          <button type="button" className="mt-3 rounded-xl border px-4 py-2" onClick={() => inputRef.current?.click()} disabled={busy}>Choose QR image</button>
          {scanResult ? <output className="mt-4 block rounded-xl border p-4 break-words" aria-label="QR scan result">{scanResult}</output> : null}
        </section>
      </div>

      {error ? <p role="alert" className="rounded-xl border p-4">{error}</p> : null}
    </section>
  );
}
