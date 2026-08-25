import { createRoute, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ArQuickFlowPanel } from '@/components/ar-quickflow-panel';
import { getWorkflow } from '@/lib/workflows/registry';
import { planFromWorkflow, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { QUICKFLOW_I18N, QUICKFLOW_TOOL_LABELS_AR } from '@/data/quickflow-i18n';
import { rootRoute } from './__root';

export const arQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/quickflow/$workflowId',
  head: () => ({ meta: [{ title: 'QuickFlow | فليكسو' }, { name: 'description', content: 'نفّذ سلسلة معالجة حتمية للصورة محليًا داخل المتصفح مع الحفاظ على الخصوصية.' }, { name: 'robots', content: 'noindex,follow' }] }),
  component: function ArabicQuickFlowPage() {
    const copy = QUICKFLOW_I18N.ar;
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
      return <ArQuickFlowPanel copy={copy} workflow={workflow ?? { id: 'improve-image', title: copy.missing, description: '', intentPatterns: [], steps: [] }} plan={plan ?? { steps: [] }} file={null} progress={null} resultUrl="" resultType="" error={copy.missing} busy={false} percent={0} currentName="" onFileChange={() => undefined} onRun={() => undefined} />;
    }

    const run = async () => {
      if (!file) { setError(copy.chooseError); return; }
      setBusy(true); setError(''); setResult(null); setProgress(null);
      try { setResult(await runWorkflowPipeline(file, plan, setProgress)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : copy.failure); }
      finally { setBusy(false); }
    };

    const percent = progress ? Math.round((progress.currentStepIndex / progress.totalSteps) * 100) : result ? 100 : 0;
    const currentName = progress?.currentToolId ? QUICKFLOW_TOOL_LABELS_AR[progress.currentToolId] ?? progress.currentToolId : '';

    return <ArQuickFlowPanel copy={copy} workflow={workflow} plan={plan} file={file} progress={progress} resultUrl={resultUrl} resultType={result?.type ?? ''} error={error} busy={busy} percent={percent} currentName={currentName} onFileChange={setFile} onRun={run} />;
  },
});
