import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { planFromIntent, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { getReadyToolConfigs } from '@/config/tools';
import { findToolIntent } from '@/lib/intent-router';

type AgentState = 'idle' | 'ready' | 'running' | 'success' | 'error';

const examples = [
  'اضغط الصورة إلى أقل من 200 كيلوبايت وحولها WebP',
  'remove background and make it square',
  'resize to 1200x800',
];

export function FlixoAIAgent() {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<AgentState>('idle');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intent = useMemo(() => query.trim() ? findToolIntent(query, getReadyToolConfigs())[0] : null, [query]);
  const planned = useMemo(() => query.trim() ? planFromIntent(query) : null, [query]);

  const prepare = () => {
    setError(null);
    setResult(null);
    setProgress(null);
    const nextPlan = planFromIntent(query);
    setPlan(nextPlan);
    setState(nextPlan ? 'ready' : 'idle');
    if (!nextPlan) setError('لم أستطع بناء أمر آمن قابل للتنفيذ من الطلب. جرّب وصفًا أوضح.');
  };

  const execute = async () => {
    if (!file || !plan) return;
    setState('running');
    setError(null);
    try {
      const output = await runWorkflowPipeline(file, plan, setProgress);
      setResult(output);
      setState('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ الأمر.');
      setState('error');
    }
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `flixo-agent-${Date.now()}.${result.type.includes('jpeg') ? 'jpg' : result.type.includes('png') ? 'png' : 'webp'}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flixo-ai-agent" aria-labelledby="flixo-ai-agent-title">
      <div className="flixo-ai-agent-glow" aria-hidden="true" />
      <div className="flixo-ai-agent-header">
        <div>
          <span className="image-tool-eyebrow">FLIXO AI AGENT</span>
          <h2 id="flixo-ai-agent-title">قل له ما تريد. وهو يخطط وينفّذ.</h2>
          <p>الوكيل يفهم الأمر، يبني خطة من أدوات FLIXO المسموح بها، ثم ينفذها محليًا مع التحقق من كل خطوة.</p>
        </div>
        <span className="flixo-ai-agent-badge">LOCAL · VERIFIED</span>
      </div>

      <div className="flixo-ai-agent-grid">
        <div className="flixo-ai-agent-inputs">
          <label htmlFor="flixo-agent-command">الأمر</label>
          <textarea
            id="flixo-agent-command"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPlan(null); setState('idle'); setError(null); }}
            placeholder="مثال: اضغط الصورة إلى أقل من 200KB وحولها إلى WebP"
            rows={3}
          />
          <div className="flixo-ai-agent-examples" aria-label="أمثلة">
            {examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)}>{example}</button>)}
          </div>

          <label htmlFor="flixo-agent-file">الصورة</label>
          <input
            id="flixo-agent-file"
            type="file"
            accept="image/*"
            onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setState('idle'); }}
          />

          <div className="flixo-ai-agent-actions">
            <button type="button" className="primary-button" onClick={prepare} disabled={!query.trim()}>تحليل الأمر</button>
            <button type="button" className="primary-button" onClick={() => void execute()} disabled={!file || !plan || state === 'running'}>تنفيذ الآن</button>
          </div>
        </div>

        <div className="flixo-ai-agent-plan" aria-live="polite">
          <div className="flixo-ai-agent-plan-topline"><strong>خطة التنفيذ</strong><span>{state === 'running' ? 'جارٍ التنفيذ…' : state === 'success' ? 'اكتمل' : state === 'error' ? 'توقف' : 'جاهز'}</span></div>
          {intent && <div className="flixo-ai-agent-intent">Intent: <strong>{intent.tool.title}</strong> · {intent.score}%</div>}
          {planned?.steps?.length ? <ol>{planned.steps.map((step, index) => <li key={`${step.toolId}-${index}`}><span>{index + 1}</span><div><strong>{step.toolId}</strong><small>{JSON.stringify(step.params ?? {})}</small></div></li>)}</ol> : <p className="flixo-ai-agent-empty">ستظهر هنا الأدوات التي اختارها الوكيل.</p>}
          {progress && <div className="flixo-ai-agent-progress"><span>الخطوة {progress.currentStepIndex}/{progress.totalSteps}</span><strong>{progress.currentToolId}</strong>{progress.retry ? <small>إعادة المحاولة {progress.retry}</small> : null}</div>}
          {error && <div className="flixo-ai-agent-error" role="alert">{error}</div>}
          {state === 'success' && result && <div className="flixo-ai-agent-success"><strong>تم التنفيذ والتحقق من الناتج.</strong><button type="button" className="primary-button" onClick={download}>تنزيل النتيجة</button></div>}
        </div>
      </div>
      <p className="flixo-ai-agent-note">الوكيل لا يتجاوز صلاحيات الأدوات: كل خطوة تمر عبر Capability Registry وقيود الموارد والتحقق من الناتج. <Link to="/admin">لوحة الإدارة</Link></p>
    </section>
  );
}
