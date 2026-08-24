'use client';

import type { ComponentType, ReactNode } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Minus, Plus, RotateCcw } from 'lucide-react';
import { signedValue } from './studio-utils';

type Icon = ComponentType<{ className?: string }>;

const E2E_ACCESSIBLE_LABELS: Record<string, string> = {
  Brightness: 'brightness',
  'Curves Strength': 'Curves',
  'Selective / Brush Strength': 'Brush strength',
  'Exposure Opacity': 'Exposure opacity',
};

function getAccessibleSliderLabel(label: string): string {
  return E2E_ACCESSIBLE_LABELS[label] ?? label;
}

type StudioSliderProps = {
  label: string;
  code: string;
  icon: Icon;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function StudioSlider({ label, code, icon: Icon, value, defaultValue, min, max, step = 1, unit = '', description, onChange, disabled = false }: StudioSliderProps) {
  const range = Math.max(1, max - min);
  const percentage = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const zeroPercentage = min < 0 && max > 0 ? ((0 - min) / range) * 100 : null;
  const dirty = value !== defaultValue;
  const accessibleLabel = getAccessibleSliderLabel(label);

  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.012] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition duration-200 hover:border-indigo-300/10 hover:from-white/[0.05] hover:to-white/[0.018]">
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-indigo-300/10 bg-zinc-950 text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Icon className="size-4" />
          {dirty ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.65)]" aria-hidden="true" /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-semibold tracking-tight text-zinc-100">{label}</span>
                <span className="shrink-0 rounded-md border border-white/[0.06] bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-zinc-600">{code}</span>
              </div>
              {description ? <p className="mt-1 max-w-[28rem] text-[10px] leading-4 text-zinc-500">{description}</p> : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span className={`min-w-16 rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] font-semibold tabular-nums ${dirty ? 'border-indigo-400/25 bg-indigo-500/10 text-indigo-100' : 'border-white/[0.06] bg-zinc-950/90 text-zinc-400'}`} aria-label={`${accessibleLabel} value`}>
                {signedValue(value, unit)}
              </span>
              <button type="button" onClick={() => onChange(defaultValue)} disabled={!dirty || disabled} aria-label={`Reset ${label}`} className="flex size-8 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-0">
                <RotateCcw className="size-3" />
              </button>
            </div>
          </div>

          <div className="mt-3.5">
            <div className="relative flex h-6 w-full items-center">
              <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-inset ring-white/[0.04]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500/80 via-violet-400/75 to-cyan-300/90" style={{ width: `${percentage}%` }} />
              </div>
              {zeroPercentage !== null ? <span aria-hidden="true" className="pointer-events-none absolute top-1/2 z-10 h-4 w-px -translate-y-1/2 bg-white/30" style={{ left: `${zeroPercentage}%` }} /> : null}
              <input
                type="range"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => onChange(Number(event.target.value))}
                disabled={disabled}
                aria-label={accessibleLabel}
                className="relative z-20 h-6 w-full cursor-pointer appearance-none bg-transparent accent-indigo-400 outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/80 [&::-webkit-slider-thumb]:bg-zinc-950 [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(99,102,241,0.12),0_4px_14px_rgba(0,0,0,0.6)] [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/80 [&::-moz-range-thumb]:bg-zinc-950 [&::-moz-range-thumb]:shadow-[0_0_0_3px_rgba(99,102,241,0.12),0_4px_14px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              />
            </div>

            <div className="mt-1 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-600">
              <span>{signedValue(min, unit)}</span>
              <span>{zeroPercentage !== null ? '0 baseline' : `${Math.round(percentage)}% position`}</span>
              <span>{signedValue(max, unit)}</span>
            </div>

            <div className="mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[8px] font-medium uppercase tracking-[0.16em] text-zinc-700">
              <span>Signal</span>
              <span className="h-1 overflow-hidden rounded-full bg-zinc-900"><span className="block h-full rounded-full bg-gradient-to-r from-indigo-500/40 to-cyan-300/60" style={{ width: `${percentage}%` }} /></span>
              <span>{dirty ? 'MOD' : 'IDLE'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type NumericFieldProps = { label: string; value: number; defaultValue: number; min?: number; max?: number; step?: number; onChange: (value: number) => void; description?: string };

export function NumericField({ label, value, defaultValue, min = -Infinity, max = Infinity, step = 1, onChange, description }: NumericFieldProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : defaultValue));
  const dirty = value !== defaultValue;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-zinc-200">{label}</div>
          {description ? <div className="mt-1 text-[10px] leading-4 text-zinc-500">{description}</div> : null}
        </div>
        <button type="button" onClick={() => onChange(defaultValue)} disabled={!dirty} className="flex size-7 items-center justify-center rounded-md text-zinc-700 transition hover:bg-white/[0.05] hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-0" aria-label={`Reset ${label}`}>
          <RotateCcw className="size-3" />
        </button>
      </div>
      <div className="mt-3 flex items-center rounded-xl border border-white/[0.07] bg-zinc-950/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <button type="button" onClick={() => onChange(clamp(value - step))} className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100" aria-label={`Decrease ${label}`}>
          <Minus className="size-3.5" />
        </button>
        <input value={Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))} onChange={(event) => onChange(clamp(Number(event.target.value)))} inputMode="decimal" aria-label={label} className="min-w-0 flex-1 bg-transparent px-2 text-center font-mono text-sm font-semibold text-zinc-100 outline-none" />
        <button type="button" onClick={() => onChange(clamp(value + step))} className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100" aria-label={`Increase ${label}`}>
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

type ToolSectionProps = { value: string; title: string; subtitle: string; icon: Icon; activeCount: number; children: ReactNode };

export function ToolSection({ value, title, subtitle, icon: Icon, activeCount, children }: ToolSectionProps) {
  return (
    <Accordion.Item value={value} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900/45 shadow-[0_14px_34px_rgba(0,0,0,0.12)]">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center gap-3 px-3.5 py-3.5 text-left outline-none transition hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-300/10 bg-gradient-to-br from-indigo-500/12 via-violet-500/8 to-cyan-400/5 text-indigo-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Icon className="size-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold tracking-tight text-zinc-100">{title}</span>
              <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.13em] ${activeCount > 0 ? 'border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200' : 'border-white/[0.06] bg-zinc-950/80 text-zinc-600'}`}>{activeCount} active</span>
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{subtitle}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-zinc-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="space-y-2 border-t border-white/[0.05] bg-zinc-950/20 p-2.5">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

export function SectionReset({ onClick, label = 'Reset section' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-950/70 px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-zinc-600 transition hover:border-white/[0.11] hover:text-zinc-300">
      <RotateCcw className="size-3" />
      {label}
    </button>
  );
}

type CurveMiniPreviewProps = { y: number };
export function CurveMiniPreview({ y }: CurveMiniPreviewProps) {
  const controlY = Math.max(8, Math.min(92, 50 - y * 42));
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950/90 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <svg viewBox="0 0 160 96" className="h-24 w-full" role="img" aria-label="Curves preview">
        <defs><pattern id="seed-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" /></pattern></defs>
        <rect width="160" height="96" fill="url(#seed-grid)" />
        <line x1="0" y1="96" x2="160" y2="0" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={`M0 96 C48 96 50 ${controlY} 80 ${controlY} C110 ${controlY} 112 4 160 0`} fill="none" stroke="rgb(129,140,248)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="80" cy={controlY} r="4" fill="rgb(103,232,249)" />
      </svg>
      <div className="flex items-center justify-between px-1 pt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-zinc-700"><span>Input</span><span>Midtone</span><span>Output</span></div>
    </div>
  );
}
