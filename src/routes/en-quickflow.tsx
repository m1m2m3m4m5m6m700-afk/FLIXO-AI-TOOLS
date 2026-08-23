import { createRoute, Link, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { getWorkflow } from '@/lib/workflows/registry';
import { planFromWorkflow, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { rootRoute } from './__root';

function extensionForMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

export const enQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/quickflow/$workflowId',
  head: () => ({ meta: [
    { title: 'QuickFlow | FLIXO' },
    { name: 'description', content: 'Run a deterministic FLIXO image workflow locally in your browser.' },
    { name: 'robots', content: 'noindex,follow' },
  ] }),
  component: function QuickFlowPage() {
    const { workflowId } = useParams({ from: '/en/quickflow/$workflowId' });
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

    if (!workflow || !plan) {
      return <main className="image-tool-shell"><div className="image-tool-container"><h1>QuickFlow not found</h1><Link className="primary-button" to="/">Back to FLIXO</Link></div></main>;
    }

    const run = async () => {
      if (!file) { setError('Choose an image first.'); return; }
      setBusy(true); setError(''); setResult(null); setProgress(null);
      try { setResult(await runWorkflowPipeline(file, plan, setProgress)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Workflow failed.'); }
      finally { setBusy(false); }
    };

    const percent = progress ? Math.round((progress.currentStepIndex / progress.totalSteps) * 100) : result ? 100 : 0;
    const currentName = progress?.currentToolId ?? '';

    return (
      <main className="image-tool-shell">
        <div className="image-tool-container">
          <Link to="/" className="language-link">← FLIXO</Link>
          <p className="image-tool-eyebrow" style={{ marginTop: 28 }}>QUICKFLOW · LOCAL-FIRST</p>
          <h1>{workflow.title}</h1>
          <p className="image-tool-lead">{workflow.description}</p>
          <section className="compressor-card" aria-label="Run QuickFlow">
            <label className="upload-zone" htmlFor="quickflow-file">
              <span className="upload-title">{file ? file.name : 'Choose an image to start'}</span>
              <span className="upload-subtitle">Processing stays in your browser.</span>
            </label>
            <input id="quickflow-file" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {plan.steps.map((step, index) => <div key={`${step.toolId}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 12 }}><strong>{index + 1}.</strong><span>{step.toolId}</span></div>)}
            </div>
            <div style={{ marginTop: 18 }}><strong>{percent}%</strong>{currentName ? ` · ${currentName}` : ''}<div aria-hidden="true" style={{ height: 8, marginTop: 8, borderRadius: 999, background: 'var(--surface-muted, #eee)', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', background: 'currentColor', transition: 'width 180ms ease' }} /></div></div>
            {error && <div className="error-box" role="alert" style={{ marginTop: 14 }}>{error}</div>}
            <button type="button" className="primary-button" style={{ marginTop: 18 }} disabled={busy || !file} onClick={run}>{busy ? 'Running…' : 'Run workflow'}</button>
          </section>
          {result && <section className="result-card" style={{ marginTop: 20 }}><h2>Result ready</h2><img src={resultUrl} alt="FLIXO QuickFlow result" className="preview-image" /><a className="download-button" href={resultUrl} download={`flixo-${workflow.id}.${extensionForMime(result.type)}`}>Download result</a></section>}
        </div>
      </main>
    );
  },
});
