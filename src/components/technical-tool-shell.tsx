import type { ReactNode } from 'react';
import { Activity, CheckCircle2, Download, RotateCcw, Upload, Command } from 'lucide-react';
import { getToolUiCopy } from '@/data/tool-ui-i18n';
import './technical-tool-shell-premium.css';

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
  onCommandMenu?: () => void;
  children: ReactNode;
};

const actionClass = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 text-xs text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition duration-200 hover:-translate-y-px hover:border-violet-300/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70';

export function TechnicalToolShell({ title, eyebrow, description, ready = true, progress, onUpload, onReset, onExport, exportDisabled = false, onCommandMenu, children }: TechnicalToolShellProps) {
  const copy = getToolUiCopy();

  return (
    <div className="relative mx-auto w-full max-w-[1480px] p-2 sm:p-3 lg:p-4">
      <div className="flixo-premium-shell relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#050507] shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        <div className="flixo-premium-grid pointer-events-none absolute inset-0 opacity-45" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-500/[0.05] via-indigo-500/[0.02] to-transparent" />

        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-zinc-950/75 px-3 py-3 backdrop-blur-2xl sm:px-4 sm:py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="min-w-0 truncate text-sm font-semibold tracking-tight text-white">{title}</div>
              {eyebrow ? <span className="hidden rounded-md border border-violet-300/10 bg-violet-500/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-violet-200/65 md:inline">{eyebrow}</span> : null}
            </div>
            {description ? <p className="mt-1 max-w-2xl truncate text-[11px] leading-5 text-zinc-500">{description}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400" aria-label={ready ? copy.ready : copy.waiting}>
              <span className={`flixo-status-dot size-1.5 rounded-full ${ready ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.75)]' : 'bg-zinc-600'}`} />
              <Activity className="size-3" aria-hidden="true" />
              {ready ? copy.ready : copy.waiting}
            </div>

            {onCommandMenu ? (
              <button type="button" onClick={onCommandMenu} className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-300/10 bg-violet-500/[0.06] px-2.5 text-xs text-violet-100 transition hover:bg-violet-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70" aria-label={copy.openCommandPalette}>
                <Command className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{copy.command}</span>
                <kbd className="hidden rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[9px] text-violet-200/70 sm:inline">⌘K</kbd>
              </button>
            ) : null}

            {onUpload ? <button type="button" onClick={onUpload} className={actionClass} aria-label={copy.upload}><Upload className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.upload}</span></button> : null}
            {onReset ? <button type="button" onClick={onReset} className={actionClass} aria-label={copy.reset}><RotateCcw className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.reset}</span></button> : null}
            {onExport ? <button type="button" onClick={onExport} disabled={exportDisabled} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300/20 bg-gradient-to-r from-violet-500 to-indigo-500 px-3 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(99,102,241,0.28)] transition duration-200 hover:-translate-y-px hover:from-violet-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0" aria-label={copy.exportLabel}><Download className="size-3.5" aria-hidden="true" />{copy.exportLabel}</button> : null}
          </div>
        </header>

        {typeof progress === 'number' ? (
          <div className="relative h-0.5 overflow-hidden bg-zinc-900/90">
            <div className="h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-emerald-400 transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
        ) : null}

        <div className="relative z-10 p-2.5 sm:p-3 lg:p-4">{children}</div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 px-1 text-[9px] text-zinc-600"><CheckCircle2 className="size-3" aria-hidden="true" />{copy.localWorkspace}</div>
    </div>
  );
}
