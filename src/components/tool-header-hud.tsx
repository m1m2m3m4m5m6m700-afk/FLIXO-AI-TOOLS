import type { ReactNode } from 'react';
import { Activity, Command, Download, RotateCcw, Upload } from 'lucide-react';
import { getToolUiCopy } from '@/data/tool-ui-i18n';

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

export function ToolHeaderHUD({ title, eyebrow, ready = true, description, onUpload, onReset, onExport, exportDisabled = false, onCommandMenu, trailing }: ToolHeaderHUDProps) {
  const copy = getToolUiCopy();

  return (
    <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0a0c0f]/96 px-3 py-2.5 backdrop-blur-xl sm:px-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white">{title}</h1>
          {eyebrow ? <span className="hidden border-l border-white/[0.12] pl-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500 md:inline">{eyebrow}</span> : null}
        </div>
        {description ? <p className="mt-0.5 max-w-2xl truncate text-[11px] leading-5 text-zinc-500">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <div className="flixo-tool-status" aria-label={ready ? copy.ready : copy.waiting}>
          <span className={`flixo-status-dot ${ready ? 'is-ready' : ''}`} />
          <Activity className="size-3" aria-hidden="true" />
          {ready ? copy.ready : copy.waiting}
        </div>
        {onCommandMenu ? <button type="button" onClick={onCommandMenu} className="flixo-tool-action" aria-label={copy.openCommandPalette}><Command className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.command}</span><kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-zinc-500 sm:inline">⌘K</kbd></button> : null}
        {onUpload ? <button type="button" onClick={onUpload} className="flixo-tool-action" aria-label={copy.upload}><Upload className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.upload}</span></button> : null}
        {onReset ? <button type="button" onClick={onReset} className="flixo-tool-action" aria-label={copy.reset}><RotateCcw className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.reset}</span></button> : null}
        {onExport ? <button type="button" onClick={onExport} disabled={exportDisabled} className="flixo-tool-primary" aria-label={copy.exportLabel}><Download className="size-3.5" aria-hidden="true" />{copy.exportLabel}</button> : null}
        {trailing}
      </div>
    </header>
  );
}
