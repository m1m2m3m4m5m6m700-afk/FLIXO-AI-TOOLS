import type { ComponentType, ReactNode } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Slider from '@radix-ui/react-slider';
import { ChevronDown, Minus, Plus, RotateCcw } from 'lucide-react';
import { signedValue } from './studio-utils';

type Icon = ComponentType<{ className?: string }>;

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

export function StudioSlider({
  label,
  code,
  icon: Icon,
  value,
  defaultValue,
  min,
  max,
  step = 1,
  unit = '',
  description,
  onChange,
  disabled = false,
}: StudioSliderProps) {
  const range = Math.max(1, max - min);
  const percentage = ((value - min) / range) * 100;
  const zeroPercentage = min < 0 && max > 0 ? ((0 - min) / range) * 100 : null;
  const dirty = value !== defaultValue;

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition duration-200 hover:border-white/[0.11] hover:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-950 text-zinc-400 shadow-inner">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-zinc-100">{label}</span>
                <span className="rounded border border-white/[0.06] bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">{code}</span>
              </div>
              {description ? <p className="mt-1 text-[10px] leading-4 text-zinc-500">{description}</p> : null}
            </div>
            <div className="flex items-center gap-1">
              <span className={`min-w-14 rounded-md border px-2 py-1 text-center font-mono text-[11px] tabular-nums ${dirty ? 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200' : 'border-white/[0.06] bg-zinc-950/80 text-zinc-400'}`}>
                {signedValue(value, unit)}
              </span>
              <button
                type="button"
                onClick={() => onChange(defaultValue)}
                disabled={!dirty || disabled}
                aria-label={`Reset ${label}`}
                className="flex size-7 items-center justify-center rounded-md text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-0"
              >
                <RotateCcw className="size-3" />
              </button>
            </div>
          </div>

          <div className="mt-3 px-0.5">
            <Slider.Root
              value={[value]}
              min={min}
              max={max}
              step={step}
              onValueChange={([next]) => onChange(next ?? value)}
              disabled={disabled}
              className="relative flex h-5 w-full touch-none select-none items-center"
              aria-label={label}
            >
              <Slider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-inset ring-white/[0.04]">
                <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-indigo-500/70 to-cyan-400/80" />
              </Slider.Track>
              {zeroPercentage !== null ? <span aria-hidden="true" className="pointer-events-none absolute top-1/2 z-10 h-3 -translate-y-1/2 w-px bg-white/25" style={{ left: `${zeroPercentage}%` }} /> : null}
              <Slider.Thumb className="block size-4 rounded-full border border-white/70 bg-zinc-950 shadow-[0_0_0_3px_rgba(99,102,241,0.14),0_2px_10px_rgba(0,0,0,0.5)] outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:pointer-events-none disabled:opacity-50" />
            </Slider.Root>
            <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">
              <span>{signedValue(min, unit)}</span>
              <span>{zeroPercentage !== null ? '0 baseline' : 'range'}</span>
              <span>{signedValue(max, unit)}</span>
            </div>
            <div className="mt-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <div className="mt-2 flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-600">
              <span>Realtime</span>
              <span>{Math.round(percentage)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type NumericFieldProps = {
  label: string;
  value: number;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  description?: string;
};

export function NumericField({ label, value, defaultValue, min = -Infinity, max = Infinity, step = 1, onChange, description }: NumericFieldProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : defaultValue));
  const dirty = value !== defaultValue;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium text-zinc-200">{label}</div>
          {description ? <div className="mt-1 text-[10px] text-zinc-500">{description}</div> : null}
        </div>
        <button type="button" onClick={() => onChange(defaultValue)} disabled={!dirty} className="text-zinc-600 transition hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-0" aria-label={`Reset ${label}`}>
          <RotateCcw className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 flex items-center rounded-lg border border-white/[0.07] bg-zinc-950/80 p-1 shadow-inner">
        <button type="button" onClick={() => onChange(clamp(value - step))} className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100" aria-label={`Decrease ${label}`}>
          <Minus className="size-3.5" />
        </button>
        <input
          value={Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          inputMode="decimal"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent px-2 text-center font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-700"
        />
        <button type="button" onClick={() => onChange(clamp(value + step))} className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100" aria-label={`Increase ${label}`}>
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

type ToolSectionProps = {
  value: string;
  title: string;
  subtitle: string;
  icon: Icon;
  activeCount: number;
  children: ReactNode;
};

export function ToolSection({ value, title, subtitle, icon: Icon, activeCount, children }: ToolSectionProps) {
  return (
    <Accordion.Item value={value} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/45 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center gap-3 px-3.5 py-3.5 text-left outline-none transition hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-indigo-300/10 bg-gradient-to-br from-indigo-500/10 to-cyan-400/5 text-indigo-200">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-zinc-100">{title}</span>
              <span className="rounded-full border border-white/[0.06] bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-zinc-500">{activeCount} active</span>
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{subtitle}</span>
          </span>
          <ChevronDown className="size-4 text-zinc-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-950/70 px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500 transition hover:border-white/[0.1] hover:text-zinc-300">
      <RotateCcw className="size-3" />
      {label}
    </button>
  );
}

type CurveMiniPreviewProps = { y: number };
export function CurveMiniPreview({ y }: CurveMiniPreviewProps) {
  const controlY = Math.max(8, Math.min(92, 50 - y * 42));
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-950/90 p-2">
      <svg viewBox="0 0 160 96" className="h-24 w-full" role="img" aria-label="Curves preview">
        <defs>
          <pattern id="seed-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="160" height="96" fill="url(#seed-grid)" />
        <line x1="0" y1="96" x2="160" y2="0" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={`M0 96 C48 96 50 ${controlY} 80 ${controlY} C110 ${controlY} 112 4 160 0`} fill="none" stroke="rgb(129,140,248)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="80" cy={controlY} r="4" fill="rgb(103,232,249)" />
      </svg>
      <div className="flex items-center justify-between px-1 pt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-600">
        <span>Input</span><span>Midtone</span><span>Output</span>
      </div>
    </div>
  );
}
