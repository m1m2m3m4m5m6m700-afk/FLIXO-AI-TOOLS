import type { ReactNode } from 'react';
import { Activity, Command, Download, RotateCcw, Upload } from 'lucide-react';

type ToolHeaderHUDProps = {
  title: string;
  eyebrow?: string;
  ready?: boolean;
  description?: string;
  onUpload?: () => void;
  onReset?: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  onCommandMenu?: () => void;
  trailing?: ReactNode;
};

export function ToolHeaderHUD({ title, eyebrow = 'FLIXO TOOL ENGINE', ready = true, description, onUpload, onReset, onExport, exportDisabled = false, onCommandMenu, trailing }: ToolHeaderHUDProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-zinc-950/75 px-3 py-3 backdrop-blur-2xl sm:px-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold tracking-tight text-white">{title}</h1>
          <span className="hidden rounded-md border border-violet-300/10 bg-violet-500/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-violet-200/65 md:inline">{eyebrow}</span>
        </div>
        {description ? <p className="mt-1 max-w-2xl truncate text-[11px] leading-5 text-zinc-500">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
          <span className={`flixo-status-dot size-1.5 rounded-full ${ready ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.75)]' : 'bg-zinc-600'}`} />
          <Activity className="size-3" />{ready ? 'Ready' : 'Waiting'}
        </div>
        {onCommandMenu ? <button type="button" onClick={onCommandMenu} className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-300/10 bg-violet-500/[0.06] px-2.5 text-xs text-violet-100 transition hover:bg-violet-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70" aria-label="Open command palette"><Command className="size-3.5" /><span className="hidden sm:inline">Command</span><kbd className="hidden rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[9px] text-violet-200/70 sm:inline">⌘K</kbd></button> : null}
        {onUpload ? <button type="button" onClick={onUpload} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 text-xs text-zinc-300 transition hover:-translate-y-px hover:border-violet-300/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70" aria-label="Upload"><Upload className="size-3.5" /><span className="hidden sm:inline">Upload</span></button> : null}
        {onReset ? <button type="button" onClick={onReset} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 text-xs text-zinc-300 transition hover:-translate-y-px hover:border-violet-300/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70" aria-label="Reset"><RotateCcw className="size-3.5" /><span className="hidden sm:inline">Reset</span></button> : null}
        {onExport ? <button type="button" onClick={onExport} disabled={exportDisabled} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300/20 bg-gradient-to-r from-violet-500 to-indigo-500 px-3 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(99,102,241,0.28)] transition hover:-translate-y-px hover:from-violet-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0" aria-label="Export"><Download className="size-3.5" />Export</button> : null}
        {trailing}
      </div>
    </header>
  );
}
