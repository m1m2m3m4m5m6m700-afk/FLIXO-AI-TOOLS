import React, { useState } from 'react';
import { decodeText, encodeText, fileToDataUrl, parseDataUrl } from './engine';

export function Base64EncoderDecoderTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [filePreview, setFilePreview] = useState('');

  const run = () => {
    setError('');
    setFilePreview('');
    try {
      setOutput(mode === 'encode' ? encodeText(text) : decodeText(text));
    } catch (cause) {
      setOutput('');
      setError(cause instanceof Error ? cause.message : 'Invalid Base64 input');
    }
  };

  const handleFile = async (file: File) => {
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const base64 = dataUrl.split(',', 2)[1] ?? '';
      setText(base64);
      setOutput(dataUrl);
      setFileName(file.name);
      setFileMime(file.type || 'application/octet-stream');
      if (file.type.startsWith('image/')) setFilePreview(dataUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read file');
    }
  };

  const previewDecodedDataUri = () => {
    setError('');
    try {
      const parsed = parseDataUrl(text);
      const dataUrl = `data:${parsed.mime};base64,${btoa(String.fromCharCode(...parsed.bytes))}`;
      setFilePreview(parsed.mime.startsWith('image/') ? dataUrl : '');
      setOutput(dataUrl);
      setFileMime(parsed.mime);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid Base64 data URI');
    }
  };

  const download = () => {
    if (!output) return;
    const href = output.startsWith('data:') ? output : `data:text/plain;charset=utf-8,${encodeURIComponent(output)}`;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = fileName || (fileMime.startsWith('image/') ? 'decoded-image' : 'flixo-base64.txt');
    anchor.click();
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Base64 Encoder / Decoder</h1>
        <p className="mt-2 opacity-80">Encode text and files or decode Base64 entirely in your browser.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode('encode')}>Encode</button>
        <button type="button" onClick={() => setMode('decode')}>Decode</button>
        <button type="button" onClick={run}>Run</button>
        <button type="button" onClick={previewDecodedDataUri}>Preview Data URI</button>
        <button type="button" onClick={download} disabled={!output}>Download</button>
        <label>File<input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /></label>
      </div>
      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="base64-input" className="mb-2 block font-semibold">Input</label>
          <textarea id="base64-input" className="min-h-[360px] w-full rounded border p-4 font-mono" value={text} onChange={(event) => setText(event.target.value)} />
        </div>
        <div>
          <label htmlFor="base64-output" className="mb-2 block font-semibold">Output</label>
          <textarea id="base64-output" className="min-h-[360px] w-full rounded border p-4 font-mono" readOnly value={output} />
          {error && <p role="alert" className="mt-2">{error}</p>}
          {filePreview && <img src={filePreview} alt="Decoded preview" className="mt-4 max-h-64 rounded border" />}
        </div>
      </section>
    </main>
  );
}
