import type { ReactNode } from 'react';
import { Activity, CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';

type TechnicalToolShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  ready?: boolean;
  progress?: number;
  onUpload?: () => void;
  onReset?: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  children: ReactNode;
};

export function TechnicalToolShell({
  title,
  eyebrow = 'FLIXO TOOL ENGINE',
  description,
  ready = true,
  progress,
  onUpload,
  onReset,
  onExport,
  exportDisabled = false,
  children,
}: TechnicalToolShellProps) {
  return (
    <div className="mx-auto w-full max-w-[1480px] p-3 sm:p-4">
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-950/90 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white">{title}</h1>
              <span className="hidden rounded border border-white/[0.06] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500 md:inline">{eyebrow}</span>
            </div>
            {description ? <p className="mt-1 text-[11px] text-zinc-500">{description}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/80 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              <span className={`size-1.5 rounded-full ${ready ? 'bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.8)]' : 'bg-zinc-700'}`} />
              <Activity className="size-3" />
              {ready ? 'Ready' : 'Waiting'}
            </div>
            {onUpload ? <button type="button" onClick={onUpload} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900 px-2.5 text-xs text-zinc-300 transition hover:border-white/[0.12] hover:text-white"><Upload className="size-3.5" />Upload</button> : null}
            {onReset ? <button type="button" onClick={onReset} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900 px-2.5 text-xs text-zinc-300 transition hover:border-white/[0.12] hover:text-white"><RotateCcw className="size-3.5" />Reset</button> : null}
            {onExport ? <button type="button" onClick={onExport} disabled={exportDisabled} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-300/20 bg-indigo-500 px-3 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"><Download className="size-3.5" />Export</button> : null}
          </div>
        </header>
        {typeof progress === 'number' ? <div className="h-0.5 bg-zinc-900"><div className="h-full bg-indigo-500 transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div> : null}
        <div className="p-3 sm:p-4">{children}</div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[9px] text-zinc-600"><CheckCircle2 className="size-3" />Local-first technical workspace</div>
    </div>
  );
}
