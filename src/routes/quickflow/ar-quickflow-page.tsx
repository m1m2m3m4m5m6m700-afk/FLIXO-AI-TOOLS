import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArQuickFlowPanel } from "@/components/ar-quickflow-panel";
import { getWorkflow } from "@/lib/workflows/registry";
import { planFromWorkflow } from "@/lib/ai/planner";
import { runWorkflowPipeline, type PipelineProgress } from "@/lib/workflows/pipeline-runner";
import { QUICKFLOW_I18N, QUICKFLOW_TOOL_LABELS_AR } from "@/data/quickflow-i18n";

export function ArQuickFlowPage() {
  const copy = QUICKFLOW_I18N.ar;
  const { workflowId } = useParams({ from: "/ar/quickflow/$workflowId" });
  const workflow = getWorkflow(workflowId);
  const plan = useMemo(() => planFromWorkflow(workflowId), [workflowId]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resultUrl = useMemo(() => (result ? URL.createObjectURL(result) : ""), [result]);
  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl],
  );

  if (!workflow || !plan)
    return (
      <main dir="rtl" lang="ar" className="image-tool-shell">
        <div className="image-tool-container">
          <h1>{copy.missing}</h1>
          <Link className="primary-button" to="/ar">
            {copy.back}
          </Link>
        </div>
      </main>
    );

  const run = async () => {
    if (!file) {
      setError(copy.chooseError);
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(null);
    try {
      setResult(await runWorkflowPipeline(file, plan, setProgress));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failure);
    } finally {
      setBusy(false);
    }
  };

  const percent = progress
    ? Math.round((progress.currentStepIndex / progress.totalSteps) * 100)
    : result
      ? 100
      : 0;
  const currentName = progress?.currentToolId
    ? (QUICKFLOW_TOOL_LABELS_AR[progress.currentToolId] ?? progress.currentToolId)
    : "";

  return (
    <ArQuickFlowPanel
      copy={copy}
      workflow={workflow}
      plan={plan}
      file={file}
      resultUrl={resultUrl}
      resultType={result?.type ?? ""}
      error={error}
      busy={busy}
      percent={percent}
      currentName={currentName}
      onFileChange={setFile}
      onRun={run}
    />
  );
}
