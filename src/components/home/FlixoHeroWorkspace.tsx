import { CheckCircle2, Layers, ShieldCheck, Sliders, Sparkles, Wand2, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ElegantAdSlot } from '@/components/ads/ElegantAdSlot';

type HeroCopy = {
  badge: string;
  eyebrow: string;
  title: string;
  lead: string;
  describe: string;
  workspace: string;
  ready: string;
  processTab: string;
  layersTab: string;
  settingsTab: string;
  processTitle: string;
  processDescription: string;
  processAction: string;
  processingAction?: string;
  layersDescription: string;
  settingsDescription: string;
  speedTitle: string;
  speedDescription: string;
  privacyTitle: string;
  privacyDescription: string;
  apiTitle: string;
  apiDescription: string;
  workspaceLabel?: string;
};

type FlixoHeroWorkspaceProps = {
  copy: HeroCopy;
  onDescribeTask?: () => void;
  onProcess?: () => void;
  children?: ReactNode;
};

export function FlixoHeroWorkspace({ copy, onDescribeTask, onProcess, children }: FlixoHeroWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'process' | 'layers' | 'settings'>('process');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcess = () => {
    if (!onProcess || isProcessing) return;
    setIsProcessing(true);
    onProcess();
    window.setTimeout(() => setIsProcessing(false), 900);
  };

  return (
    <section className="relative space-y-8 overflow-hidden rounded-[28px] bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8" dir="rtl" aria-labelledby="flixo-hero-title">
      <div className="pointer-events-none absolute right-1/4 top-0 h-[420px] w-[420px] rounded-full bg-violet-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-[340px] w-[340px] rounded-full bg-blue-600/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-6xl space-y-7">
        <ElegantAdSlot />

        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-100 backdrop-blur-md">
            <Sparkles className="size-4 text-violet-300" aria-hidden="true" />
            {copy.badge}
          </span>
        </div>

        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-300/70">{copy.eyebrow}</p>
          <h1 id="flixo-hero-title" className="text-4xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">{copy.title}</h1>
          <p className="text-base leading-7 text-slate-400 sm:text-lg">{copy.lead}</p>
          {onDescribeTask ? (
            <button type="button" onClick={onDescribeTask} className="mx-auto inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
              <Wand2 className="size-4" aria-hidden="true" />
              {copy.describe}
            </button>
          ) : null}
        </div>

        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/65 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-slate-800/80 px-4 py-3.5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2" aria-hidden="true">
                <span className="size-3 rounded-full bg-red-500/80" />
                <span className="size-3 rounded-full bg-yellow-500/80" />
                <span className="size-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs font-medium text-slate-400">{copy.workspace}</span>
              <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">{copy.ready}</span>
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-7">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
              <button type="button" onClick={() => setActiveTab('process')} aria-pressed={activeTab === 'process'} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${activeTab === 'process' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <Wand2 className="size-4" aria-hidden="true" />{copy.processTab}
              </button>
              <button type="button" onClick={() => setActiveTab('layers')} aria-pressed={activeTab === 'layers'} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${activeTab === 'layers' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <Layers className="size-4" aria-hidden="true" />{copy.layersTab}
              </button>
              <button type="button" onClick={() => setActiveTab('settings')} aria-pressed={activeTab === 'settings'} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${activeTab === 'settings' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <Sliders className="size-4" aria-hidden="true" />{copy.settingsTab}
              </button>
            </div>

            {activeTab === 'process' ? (
              <div className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/30 p-8 text-center transition hover:border-violet-400/40">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-300">
                  <Zap className="size-6" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">{copy.processTitle}</h2>
                <p className="mt-1 text-sm text-slate-400">{copy.processDescription}</p>
                <button type="button" onClick={handleProcess} disabled={!onProcess || isProcessing} className="mt-6 inline-flex items-center justify-center rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60">
                  {isProcessing ? (copy.processingAction ?? copy.processAction) : copy.processAction}
                </button>
                {children}
              </div>
            ) : null}

            {activeTab === 'layers' ? <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">{copy.layersDescription}</div> : null}
            {activeTab === 'settings' ? <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">{copy.settingsDescription}</div> : null}

            <div className="grid gap-4 border-t border-slate-800/80 pt-5 md:grid-cols-3">
              <Feature icon={<CheckCircle2 className="size-5" aria-hidden="true" />} title={copy.speedTitle} description={copy.speedDescription} />
              <Feature icon={<ShieldCheck className="size-5" aria-hidden="true" />} title={copy.privacyTitle} description={copy.privacyDescription} />
              <Feature icon={<Zap className="size-5" aria-hidden="true" />} title={copy.apiTitle} description={copy.apiDescription} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-emerald-400">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
    </div>
  );
}
