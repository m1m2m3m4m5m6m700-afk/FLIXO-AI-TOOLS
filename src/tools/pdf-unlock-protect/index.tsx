import { useEffect, useState } from 'react';
import { bytesToPdfBlob, protectPdf, unlockPdf, type PdfPermission, type PdfSecurityMode } from './engine';

const PERMISSIONS: Array<{ id: PdfPermission; label: string }> = [
  { id: 'printing', label: 'Printing' },
  { id: 'copying', label: 'Copying' },
  { id: 'modifying', label: 'Modifying' },
  { id: 'annotating', label: 'Annotations' },
  { id: 'fillingForms', label: 'Filling forms' },
  { id: 'extracting', label: 'Text extraction' },
  { id: 'assembly', label: 'Page assembly' },
  { id: 'highQualityPrint', label: 'High-quality printing' },
];

function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(bytesToPdfBlob(bytes));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PdfUnlockProtectTool() {
  const [mode, setMode] = useState<PdfSecurityMode>('protect');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [permissions, setPermissions] = useState<Record<PdfPermission, boolean>>(() =>
    Object.fromEntries(PERMISSIONS.map(({ id }) => [id, true])) as Record<PdfPermission, boolean>,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setPassword('');
    setOwnerPassword('');
    setError('');
    setSuccess('');
  }, [mode]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'protect') {
        const result = await protectPdf(file, {
          userPassword: password,
          ownerPassword: ownerPassword || password,
          permissions,
        });
        downloadBytes(result.bytes, `${file.name.replace(/\.pdf$/i, '')}${result.filenameSuffix}.pdf`);
        setSuccess('PDF protected successfully.');
      } else {
        const result = await unlockPdf(file, password);
        downloadBytes(result.bytes, `${file.name.replace(/\.pdf$/i, '')}${result.filenameSuffix}.pdf`);
        setSuccess('PDF unlocked successfully.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PDF security operation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6" aria-labelledby="pdf-security-title">
      <header>
        <h1 id="pdf-security-title" className="text-3xl font-bold">PDF Unlock &amp; Protect</h1>
        <p className="mt-2 text-sm opacity-75">Password-protect or unlock PDF files entirely in your browser.</p>
      </header>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="PDF security mode">
        {(['protect', 'unlock'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${mode === value ? 'border-current' : 'opacity-60'}`}
            onClick={() => setMode(value)}
          >
            {value === 'protect' ? 'Protect PDF' : 'Unlock PDF'}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2 rounded-2xl border border-dashed p-6">
        <span className="font-medium">Select PDF</span>
        <input id="pdf-security-input" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        {file && <span className="text-sm opacity-70">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
      </label>

      <label className="flex flex-col gap-2">
        <span>{mode === 'protect' ? 'User password' : 'PDF password'}</span>
        <input className="rounded-xl border px-4 py-3" type="password" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" />
      </label>

      {mode === 'protect' && (
        <>
          <label className="flex flex-col gap-2">
            <span>Owner password (optional)</span>
            <input className="rounded-xl border px-4 py-3" type="password" value={ownerPassword} autoComplete="new-password" onChange={(event) => setOwnerPassword(event.target.value)} placeholder="Defaults to user password" />
          </label>
          <fieldset className="rounded-2xl border p-4">
            <legend className="px-2 font-semibold">Permissions</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {PERMISSIONS.map(({ id, label }) => (
                <label key={id} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={permissions[id]} onChange={(event) => setPermissions((current) => ({ ...current, [id]: event.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <button type="button" className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-50" disabled={!file || !password || busy} onClick={run}>
        {busy ? 'Processing locally…' : mode === 'protect' ? 'Protect PDF' : 'Unlock PDF'}
      </button>

      {error && <div role="alert" className="rounded-xl border p-4">{error}</div>}
      {success && <div role="status" className="rounded-xl border p-4">{success}</div>}
    </section>
  );
}
