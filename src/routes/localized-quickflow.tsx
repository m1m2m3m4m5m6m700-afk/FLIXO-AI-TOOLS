import { createRoute, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { isLocale } from '@/lib/i18n';
import { LOCALE_METADATA } from '@/lib/i18n/config';
import { getWorkflow } from '@/lib/workflows/registry';
import { planFromWorkflow, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { QUICKFLOW_LOCALES } from '@/data/quickflow-locales';
import { QUICKFLOW_COPY_OVERRIDES } from '@/lib/i18n/locale-quality-overrides';
import { rootRoute } from './__root';

function extensionForMime(mime: string) { if (mime === 'image/png') return 'png'; if (mime === 'image/jpeg') return 'jpg'; if (mime === 'image/webp') return 'webp'; return 'bin'; }

export const localizedQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale/quickflow/$workflowId',
  component: function LocalizedQuickFlowPage() {
    const { locale: rawLocale, workflowId } = useParams({ from: '/$locale/quickflow/$workflowId' });
    const locale = isLocale(rawLocale) ? rawLocale : 'en';
    const copy = { ...QUICKFLOW_LOCALES[locale], ...(QUICKFLOW_COPY_OVERRIDES[locale] ?? {}) };
    const workflow = getWorkflow(workflowId);
    const [file, setFile] = useState<File | null>(null);
    const [plan, setPlan] = useState<ExecutionPlan | null>(() => planFromWorkflow(workflowId));
    const [progress, setProgress] = useState<PipelineProgress | null>(null);
    const [result, setResult] = useState<Blob | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => setPlan(planFromWorkflow(workflowId)), [workflowId]);
    const resultUrl = useMemo(() => result ? URL.createObjectURL(result) : '', [result]);
    useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

    const homeHref = `/${locale}`;
    const direction = LOCALE_METADATA[locale].direction;

    if (!workflow || !plan) return <main lang={locale} dir={direction}><div className="image-tool-container"><h1>{copy.missing}</h1><a className="primary-button" href={homeHref}>{copy.back}</a></div></main>;

    const run = async () => {
      if (!file) { setError(copy.chooseError); return; }
      setBusy(true); setError(''); setResult(null); setProgress(null);
      try { setResult(await runWorkflowPipeline(file, plan, setProgress)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : copy.failure); }
      finally { setBusy(false); }
    };

    const percent = progress ? Math.round((progress.currentStepIndex / progress.totalSteps) * 100) : result ? 100 : 0;
    return (
      <main className="image-tool-shell" lang={locale} dir={direction}>
        <div className="image-tool-container">
          <a href={homeHref} className="language-link">← FLIXO</a>
          <p className="image-tool-eyebrow" style={{ marginTop: 28 }}>{copy.eyebrow}</p>
          <h1>{workflow.title}</h1>
          <p className="image-tool-lead">{workflow.description}</p>
          <section className="compressor-card" aria-label={copy.runLabel}>
            <label className="upload-zone" htmlFor="quickflow-file"><span className="upload-title">{file ? file.name : copy.choose}</span><span className="upload-subtitle">{copy.processing}</span></label>
            <input id="quickflow-file" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <button type="button" className="primary-button" disabled={busy} onClick={run}>{busy ? copy.running : copy.run}</button>
            {progress && <p role="status" aria-live="polite">{copy.progress} {percent}%</p>}
            {error && <p role="alert">{error}</p>}
            {result && resultUrl && <a className="primary-button" href={resultUrl} download={`flixo-output.${extensionForMime(result.type)}`}>{copy.download}</a>}
          </section>
        </div>
      </main>
    );
  },
});
