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

const labels: Record<string, string> = {
  'background-remover': 'إزالة الخلفية',
  'image-upscaler': 'تحسين الجودة',
  'image-cropper': 'قص وتحديد الأبعاد',
  'image-compressor': 'ضغط الصورة',
  'image-converter': 'تحويل الصيغة',
  'image-effects': 'تحسين المظهر',
};

const workflowNames: Record<string, string> = {
  'product-ready': 'جاهزة للمتجر',
  'social-ready': 'جاهزة للسوشيال',
  'profile-ready': 'جاهزة للصورة الشخصية',
  'web-ready': 'جاهزة للموقع',
  'print-ready': 'جاهزة للطباعة',
  'improve-image': 'تحسين الصورة',
};

export const arQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/quickflow/$workflowId',
  head: () => ({ meta: [
    { title: 'QuickFlow | فليكسو' },
    { name: 'description', content: 'نفّذ سلسلة معالجة حتمية للصورة محليًا داخل المتصفح مع الحفاظ على الخصوصية.' },
    { name: 'robots', content: 'noindex,follow' },
  ] }),
  component: function ArabicQuickFlowPage() {
    const { workflowId } = useParams({ from: '/ar/quickflow/$workflowId' });
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
      return <main dir="rtl" lang="ar" className="image-tool-shell"><div className="image-tool-container"><h1>QuickFlow غير موجود</h1><Link className="primary-button" to="/ar">العودة إلى فليكسو</Link></div></main>;
    }

    const run = async () => {
      if (!file) { setError('اختر صورة أولًا.'); return; }
      setBusy(true); setError(''); setResult(null); setProgress(null);
      try { setResult(await runWorkflowPipeline(file, plan, setProgress)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'حدث خطأ أثناء تنفيذ المسار.'); }
      finally { setBusy(false); }
    };

    const percent = progress ? Math.round((progress.currentStepIndex / progress.totalSteps) * 100) : result ? 100 : 0;
    const currentName = progress?.currentToolId ? labels[progress.currentToolId] ?? progress.currentToolId : '';

    return (
      <main dir="rtl" lang="ar" className="image-tool-shell">
        <div className="image-tool-container">
          <Link to="/ar" className="language-link">فليكسو ←</Link>
          <p className="image-tool-eyebrow" style={{ marginTop: 28 }}>QUICKFLOW · تنفيذ محلي</p>
          <h1>{workflowNames[workflow.id] ?? workflow.title}</h1>
          <p className="image-tool-lead">{workflow.description}</p>
          <section className="compressor-card" aria-label="تشغيل QuickFlow">
            <label className="upload-zone" htmlFor="quickflow-file-ar">
              <span className="upload-title">{file ? file.name : 'اختر صورة للبدء'}</span>
              <span className="upload-subtitle">تتم المعالجة داخل متصفحك ولا تحتاج الصورة إلى الرفع إلى خادم.</span>
            </label>
            <input id="quickflow-file-ar" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {plan.steps.map((step, index) => <div key={`${step.toolId}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 12 }}><strong>{index + 1}.</strong><span>{labels[step.toolId] ?? step.toolId}</span></div>)}
            </div>
            <div style={{ marginTop: 18 }}><strong>{percent}%</strong>{currentName ? ` · ${currentName}` : ''}<div aria-hidden="true" style={{ height: 8, marginTop: 8, borderRadius: 999, background: 'var(--surface-muted, #eee)', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', background: 'currentColor', transition: 'width 180ms ease' }} /></div></div>
            {error && <div className="error-box" role="alert" style={{ marginTop: 14 }}>{error}</div>}
            <button type="button" className="primary-button" style={{ marginTop: 18 }} disabled={busy || !file} onClick={run}>{busy ? 'جارٍ التنفيذ…' : 'تشغيل المسار'}</button>
          </section>
          {result && <section className="result-card" style={{ marginTop: 20 }}><h2>النتيجة جاهزة</h2><img src={resultUrl} alt="نتيجة QuickFlow من فليكسو" className="preview-image" /><a className="download-button" href={resultUrl} download={`flixo-${workflow.id}.${extensionForMime(result.type)}`}>تنزيل النتيجة</a></section>}
        </div>
      </main>
    );
  },
});
