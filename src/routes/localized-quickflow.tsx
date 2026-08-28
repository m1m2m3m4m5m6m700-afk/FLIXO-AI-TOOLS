import { createRoute, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { isLocale } from '@/lib/i18n';
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
    const direction = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';

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
            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>{plan.steps.map((step, index) => <div key={`${step.toolId}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 12 }}><strong>{index + 1}.</strong><span>{step.toolId}</span></div>)}</div>
            <div style={{ marginTop: 18 }}><strong>{percent}%</strong> · {copy.progress}<div aria-hidden="true" style={{ height: 8, marginTop: 8, borderRadius: 999, background: 'var(--surface-muted, #eee)', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', background: 'currentColor', transition: 'width 180ms ease' }} /></div></div>
            {error && <div className="error-box" role="alert" style={{ marginTop: 14 }}>{error}</div>}
            <button type="button" className="primary-button" style={{ marginTop: 18 }} disabled={busy || !file} onClick={run}>{busy ? copy.running : copy.run}</button>
          </section>
          {result && <section className="result-card" style={{ marginTop: 20 }}><h2>{copy.result}</h2><img src={resultUrl} alt={copy.resultAlt} className="preview-image" /><a className="download-button" href={resultUrl} download={`flixo-${workflow.id}.${extensionForMime(result.type)}`}>{copy.download}</a></section>}
        </div>
      </main>
    );
  },
});
