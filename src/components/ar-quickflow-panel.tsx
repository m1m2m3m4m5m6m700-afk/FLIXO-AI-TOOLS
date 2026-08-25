import { Link } from '@tanstack/react-router';
import { QUICKFLOW_I18N, QUICKFLOW_NAMES_AR, QUICKFLOW_TOOL_LABELS_AR } from '../data/quickflow-i18n';
import type { ExecutionPlan } from '@/lib/ai/planner';
import type { PipelineProgress } from '@/lib/workflows/pipeline-runner';
import type { Workflow } from '@/lib/workflows/types';

type Props = {
  copy: (typeof QUICKFLOW_I18N)['ar'];
  workflow: Workflow;
  plan: ExecutionPlan;
  file: File | null;
  progress: PipelineProgress | null;
  resultUrl: string;
  resultType: string;
  error: string;
  busy: boolean;
  percent: number;
  currentName: string;
  onFileChange: (file: File | null) => void;
  onRun: () => void;
};

function extensionForMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

export function ArQuickFlowPanel({ copy, workflow, plan, file, progress, resultUrl, resultType, error, busy, percent, currentName, onFileChange, onRun }: Props) {
  return (
    <main dir="rtl" lang="ar" className="image-tool-shell">
      <div className="image-tool-container">
        <Link to="/ar" className="language-link">فليكسو ←</Link>
        <p className="image-tool-eyebrow" style={{ marginTop: 28 }}>{copy.eyebrow}</p>
        <h1>{QUICKFLOW_NAMES_AR[workflow.id] ?? workflow.title}</h1>
        <p className="image-tool-lead">{workflow.description}</p>
        <section className="compressor-card" aria-label={copy.runLabel}>
          <label className="upload-zone" htmlFor="quickflow-file-ar"><span className="upload-title">{file ? file.name : copy.choose}</span><span className="upload-subtitle">{copy.processing}</span></label>
          <input id="quickflow-file-ar" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>{plan.steps.map((step, index) => <div key={`${step.toolId}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 12 }}><strong>{index + 1}.</strong><span>{QUICKFLOW_TOOL_LABELS_AR[step.toolId] ?? step.toolId}</span></div>)}</div>
          <div style={{ marginTop: 18 }}><strong>{percent}%</strong>{currentName ? ` · ${currentName}` : ''}<div aria-hidden="true" style={{ height: 8, marginTop: 8, borderRadius: 999, background: 'var(--surface-muted, #eee)', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', background: 'currentColor', transition: 'width 180ms ease' }} /></div></div>
          {error && <div className="error-box" role="alert" style={{ marginTop: 14 }}>{error}</div>}
          <button type="button" className="primary-button" style={{ marginTop: 18 }} disabled={busy || !file} onClick={onRun}>{busy ? copy.running : copy.run}</button>
        </section>
        {resultUrl && <section className="result-card" style={{ marginTop: 20 }}><h2>{copy.result}</h2><img src={resultUrl} alt={copy.resultAlt} className="preview-image" /><a className="download-button" href={resultUrl} download={`flixo-${workflow.id}.${extensionForMime(resultType)}`}>{copy.download}</a></section>}
      </div>
    </main>
  );
}
