import React, { useId, useState } from 'react';

export interface ZenCanvasProps extends React.ComponentPropsWithoutRef<'div'> {
  title?: string;
  onExecute?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

export const ZenCanvas = ({
  title = 'Zen Workspace',
  onExecute,
  children,
  className = '',
  ref,
  ...props
}: ZenCanvasProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const detailsId = useId();

  return (
    <div
      ref={ref}
      className={`relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 shadow-2xl backdrop-blur-md transition-all duration-300 ${className}`}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
        <h2 className="text-lg font-semibold tracking-wide text-white/90">{title}</h2>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-400">
          Ready
        </span>
      </div>

      <div className="space-y-6 p-6">
        {children}

        <div className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((previous) => !previous)}
            aria-expanded={showAdvanced}
            aria-controls={detailsId}
            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <span>{showAdvanced ? '▼ Hide Advanced Controls' : '▶ Show Advanced Controls'}</span>
          </button>

          {showAdvanced ? (
            <div id={detailsId} className="mt-4 space-y-3 rounded-xl border border-white/5 bg-black/30 p-4">
              <div className="grid grid-cols-1 gap-4 text-xs text-neutral-300 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-neutral-400">Render Precision</span>
                  <select className="rounded border border-white/10 bg-neutral-800/80 px-3 py-1.5 text-white outline-none focus:border-emerald-500">
                    <option value="high">High (Default)</option>
                    <option value="ultra">Ultra (Sub-pixel)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-neutral-400">Canvas Buffer</span>
                  <input type="number" defaultValue={1024} className="rounded border border-white/10 bg-neutral-800/80 px-3 py-1.5 text-white outline-none focus:border-emerald-500" />
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-white/10 bg-black/20 px-6 py-4">
        <button
          type="button"
          data-primary-cta="true"
          onClick={onExecute}
          className="w-full rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400/50 sm:w-auto"
        >
          Execute Canvas Workspace
        </button>
      </div>
    </div>
  );
};
