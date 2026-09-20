import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { planFromIntent, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { getReadyToolConfigs } from '@/config/tools';
import { findToolIntent } from '@/lib/intent-router';
import { extractParameters } from '@/lib/agent/intent/parameter-extractor';
import { detectAgentLocale } from '@/lib/agent/language-detector';
import { confirmTask, createTaskContext, transitionTask, type TaskContext } from '@/lib/agent/task-state';
import {
  classifyConversation,
  contextualizeCommand,
  loadConversationMemory,
  rememberTurn,
  setConversationTask,
  clearConversationTask,
  type ConversationMemory,
} from '@/lib/agent/conversation';
import { AGENT_I18N } from '@/data/agent-locales';
import type { Locale } from '@/lib/i18n';
import { buildFilterMaskUrl, type FilterMaskHandoff } from '@/tools/filter-mask/handoff';
import { getLiveFilter } from '@/tools/filter-mask/registry';
import { resolveFilterMaskSelection } from '@/lib/intent/resolver';
import './FlixoAIAgent.css';

type AgentState = 'idle' | 'ready' | 'running' | 'success' | 'error';
type Message = { id: number; role: 'user' | 'agent'; text: string };

const CONFIRMATIONS = /^(نعم|أيوه|ايوه|نفذ|نفّذ|ابدأ|ابدئي|موافق|تمام|yes|y|ok|okay|go|execute|run|ejecutar|exécuter|ausführen|실행|実行|jalankan|esegui|uitvoeren|wykonaj|executar|kör|ดำเนินการ|çalıştır|виконати|thực hiện)$/i;
const CANCELLATIONS = /^(لا|لأ|الغاء|إلغاء|cancel|no|n|stop)$/i;
const GENERIC_CROP_REQUEST = /(?:^|\\s)(?:(?:أريد|اريد|ممكن|هل\\s+تستطيع|please)\\s+)?(?:قص|اقت(?:ص|طع)|crop)(?:\\s+(?:صورة|الصور|الصورة|image|photo))?\\s*$/i;
const conversationalReply = (
  kind: ReturnType<typeof classifyConversation>,
  responseCopy: typeof AGENT_I18N.en,
): string | null => {
  switch (kind) {
    case 'greeting':
      return responseCopy.greeting;
    case 'thanks':
      return responseCopy.understood;
    case 'farewell':
      return responseCopy.cancelled;
    case 'capability':
      return responseCopy.lead;
    case 'help':
      return responseCopy.lead;
    case 'conversation':
      return responseCopy.greeting;
    default:
      return null;
  }
};


export function FlixoAIAgent({ locale = 'en' as Locale }: { locale?: Locale }) {
  const copy = AGENT_I18N[locale] ?? AGENT_I18N.en;
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<AgentState>('idle');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memory, setMemory] = useState<ConversationMemory>(() => loadConversationMemory());
  const [messages, setMessages] = useState<Message[]>(() => {
    const turns = loadConversationMemory().turns;
    if (turns.length === 0) return [{ id: 1, role: 'agent', text: copy.greeting }];
    return turns.map((turn, index) => ({ id: index + 1, role: turn.role, text: turn.text }));
  });
  const [messageId, setMessageId] = useState(() => loadConversationMemory().turns.length + 1);
  const [filterHandoff, setFilterHandoff] = useState<FilterMaskHandoff | null>(null);

  const contextualQuery = useMemo(() => contextualizeCommand(query, memory), [query, memory]);
  const intent = useMemo(() => contextualQuery.trim() ? findToolIntent(contextualQuery, getReadyToolConfigs())[0] : null, [contextualQuery]);
  const planned = useMemo(() => contextualQuery.trim() ? planFromIntent(contextualQuery) : null, [contextualQuery]);
  const filterMaskMatch = intent?.tool.id === 'filter-mask';

  const resolveFilterMaskHandoff = (command: string) => resolveFilterMaskSelection(command);

  const pushMessage = (role: Message['role'], text: string) => {
    setMessages((current) => [...current, { id: messageId, role, text }]);
    setMessageId((value) => value + 1);
    setMemory((current) => rememberTurn(current, { role, text }));
  };
  const applyFilterMaskHandoff = (command: string, detectedLocale: Locale) => {
    const nextHandoff = resolveFilterMaskHandoff(command);
    if (!nextHandoff) return false;
    setFilterHandoff(nextHandoff);
    setPlan(null);
    setState('ready');
    setError(null);
    setMemory((current) => setConversationTask(current, {
      command,
      toolId: 'filter-mask',
      planReady: false,
    }));
    const selected = getLiveFilter(nextHandoff.canonicalId);
    const label = selected?.label ?? nextHandoff.canonicalId;
    pushMessage(
      'agent',
      detectedLocale === 'ar'
        ? 'جهزت Filter Mask. الاختيار: ' + label + ' (' + nextHandoff.canonicalId + ')، الشدة ' + nextHandoff.parameters.intensity + '%، التكبير ' + nextHandoff.parameters.zoom.toFixed(1) + '×، النسبة ' + nextHandoff.parameters.aspectRatio + '، والجودة ' + nextHandoff.parameters.captureQuality + '. افتح المعاينة المباشرة.'
        : 'Filter Mask is ready. Selection: ' + label + ' (' + nextHandoff.canonicalId + '), intensity ' + nextHandoff.parameters.intensity + '%, zoom ' + nextHandoff.parameters.zoom.toFixed(1) + '×, aspect ' + nextHandoff.parameters.aspectRatio + ', quality ' + nextHandoff.parameters.captureQuality + '. Open the live preview.',
    );
    return true;
  };

  const buildPlan = (command: string, responseCopy = copy): ExecutionPlan | null => {
    setError(null); setResult(null); setProgress(null);
    const contextualCommand = contextualizeCommand(command, memory);
    const extracted = extractParameters(contextualCommand);
    if (!extracted.success) {
      setPlan(null); setState('error'); setError(extracted.errors.join(' '));
      return null;
    }
    const nextPlan = planFromIntent(contextualCommand);
    if (!nextPlan) { setPlan(null); setState('error'); setError(responseCopy.noSafePlan); return null; }
    const firstStep = nextPlan.steps[0];
    setMemory((current) => setConversationTask(current, {
      command: contextualCommand,
      toolId: firstStep?.toolId ?? null,
      planReady: true,
    }));
    setPlan(nextPlan); setState('ready'); return nextPlan;
  };

  const execute = async (nextPlan = plan, responseCopy = copy) => {
    if (!file || !nextPlan) return;
    setState('running'); setError(null);
    setMemory((current) => setConversationTask(current, { command: current.activeCommand ?? '', planReady: false }));
    pushMessage('agent', `${responseCopy.success} ${nextPlan.steps.length} ${responseCopy.step}.`);
    let task: TaskContext = createTaskContext();
    try {
      task = transitionTask(task, 'PLANNED');
      task = transitionTask(task, 'AWAITING_CONFIRMATION');
      task = confirmTask(task);
      const output = await runWorkflowPipeline(file, nextPlan, task, setProgress);
      task = transitionTask(task, 'VERIFYING');
      task = transitionTask(task, 'COMPLETED');
      setResult(output); setState('success'); pushMessage('agent', responseCopy.success);
    } catch (cause) {
      if (task.state === 'EXECUTING' || task.state === 'VERIFYING' || task.state === 'RECOVERING') {
        try { task = transitionTask(task, 'FAILED'); } catch { /* preserve the original execution error */ }
      }
      const message = cause instanceof Error ? cause.message : 'Execution failed.';
      setError(message); setState('error'); pushMessage('agent', `${responseCopy.stopped} ${message}`);
    }
  };

  const sendMessage = async () => {
    const command = query.trim();
    if (!command || state === 'running') return;

    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command);
    setQuery('');

    if (CONFIRMATIONS.test(command) && plan) {
      if (!file) {
        setError(responseCopy.needImage);
        pushMessage('agent', responseCopy.planReadyNoFile);
        setState('error');
        return;
      }
      await execute(plan, responseCopy);
      return;
    }

    if (CANCELLATIONS.test(command)) {
      setPlan(null);
      setState('idle');
      setError(null);
      setMemory((current) => clearConversationTask(current));
      setFilterHandoff(null);
      pushMessage('agent', responseCopy.cancelled);
      return;
    }

    if (filterMaskMatch && applyFilterMaskHandoff(command, detectedLocale)) return;

    const conversationKind = classifyConversation(command);
    const naturalReply = conversationalReply(conversationKind, responseCopy);
    if (naturalReply) {
      setPlan(null);
      setState('idle');
      setError(null);
      pushMessage('agent', naturalReply);
      return;
    }

    if (GENERIC_CROP_REQUEST.test(command)) {
      setMemory((current) => setConversationTask(current, {
        command,
        toolId: 'image-cropper',
        pendingToolId: 'image-cropper',
        pendingQuestion: detectedLocale === 'ar'
          ? 'ما النسبة أو الأبعاد التي تريدها؟ مثال: 1:1 أو 1200×800.'
          : 'What aspect ratio or dimensions do you want? For example: 1:1 or 1200×800.',
        planReady: false,
      }));
      setPlan(null);
      setState('idle');
      setError(null);
      pushMessage('agent', detectedLocale === 'ar'
        ? 'مفهوم. سنقص الصورة. ما النسبة أو الأبعاد؟ يمكنك الرد فقط بـ «مربع» أو «1:1» أو «1200×800».'
        : 'Got it. We will crop the image. What ratio or dimensions do you want? You can simply reply “square”, “1:1”, or “1200×800”.');
      return;
    }

    const nextPlan = buildPlan(command, responseCopy);
    if (!nextPlan) {
      const hasPending = Boolean(memory.pendingQuestion);
      pushMessage('agent', hasPending
        ? memory.pendingQuestion ?? responseCopy.clarification
        : responseCopy.clarification);
      return;
    }

    if (!file) {
      pushMessage('agent', responseCopy.planReadyNoFile);
      return;
    }

    pushMessage('agent', responseCopy.understood);
  };

  const prepare = () => {
    const command = query.trim(); if (!command) return;
    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command); setQuery('');
    if (filterMaskMatch && applyFilterMaskHandoff(command, detectedLocale)) return;
    const naturalReply = conversationalReply(classifyConversation(command), responseCopy);
    if (naturalReply) { pushMessage('agent', naturalReply); return; }
    if (GENERIC_CROP_REQUEST.test(command)) {
      setMemory((current) => setConversationTask(current, { command, toolId: 'image-cropper', pendingToolId: 'image-cropper', pendingQuestion: responseCopy.clarification, planReady: false }));
      pushMessage('agent', detectedLocale === 'ar' ? 'مفهوم. أعطني النسبة أو الأبعاد وسأجهز خطة القص.' : 'Understood. Give me the ratio or dimensions and I will prepare the crop plan.');
      return;
    }
    const nextPlan = buildPlan(command, responseCopy);
    if (nextPlan) pushMessage('agent', file ? `${responseCopy.planReady} ${responseCopy.execute}` : `${responseCopy.planReady} ${responseCopy.uploadThenExecute}`);
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(result); const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `flixo-agent-${Date.now()}.${result.type.includes('jpeg') ? 'jpg' : result.type.includes('png') ? 'png' : 'webp'}`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="flixo-ai-agent" aria-labelledby="flixo-ai-agent-title">
      <div className="flixo-ai-agent-glow" aria-hidden="true" />
      <div className="flixo-ai-agent-header"><div><span className="image-tool-eyebrow">FLIXO AI AGENT</span><h2 id="flixo-ai-agent-title">{copy.title}</h2><p>{copy.lead}</p></div><span className="flixo-ai-agent-badge">{copy.badge}</span></div>
      <div className="flixo-ai-agent-chat" aria-live="polite">{messages.map((message) => <div key={message.id} className={`flixo-ai-agent-message ${message.role}`}><span className="flixo-ai-agent-avatar">{message.role === 'agent' ? 'F' : 'U'}</span><div>{message.text}</div></div>)}</div>
      <div className="flixo-ai-agent-grid">
        <div className="flixo-ai-agent-inputs">
          <label htmlFor="flixo-agent-command">{copy.commandLabel}</label>
          <input id="flixo-agent-command" type="text" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void sendMessage(); } }} placeholder={copy.placeholder} autoComplete="off" />
          <div className="flixo-ai-agent-examples" aria-label={copy.examplesLabel}>{copy.examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)}>{example}</button>)}</div>
          <label htmlFor="flixo-agent-file">{copy.fileLabel}</label>
          <input id="flixo-agent-file" type="file" accept="image/*" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setState('idle'); setError(null); }} />
          <div className="flixo-ai-agent-actions"><button type="button" className="primary-button" onClick={() => void sendMessage()} disabled={!query.trim() || state === 'running'}>{copy.send}</button><button type="button" className="primary-button" onClick={prepare} disabled={!query.trim() || state === 'running'}>{copy.analyze}</button></div>
        </div>
        <div className="flixo-ai-agent-plan">
          <div className="flixo-ai-agent-plan-topline"><strong>{copy.thinking}</strong><span>{state === 'running' ? copy.executing : state === 'success' ? copy.completed : state === 'error' ? copy.needsAttention : copy.planReady}</span></div>
          {intent && <div className="flixo-ai-agent-intent">{copy.nearestTool} <strong>{intent.tool.title}</strong> · {intent.score}%</div>}
          {filterHandoff && (
            <div className="flixo-ai-agent-confirm" data-testid="filter-mask-handoff">
              <strong>{filterHandoff.canonicalId}</strong>
              <span> · intensity {filterHandoff.parameters.intensity}% · zoom {filterHandoff.parameters.zoom.toFixed(1)}× · {filterHandoff.parameters.aspectRatio} · {filterHandoff.parameters.mirror ? 'mirror' : 'direct'}</span>
              <a className="primary-button" href={buildFilterMaskUrl(locale, filterHandoff)}>
                {locale === 'ar' ? 'فتح المعاينة المباشرة' : 'Open live preview'}
              </a>
            </div>
          )}
          {planned?.steps?.length ? <ol>{planned.steps.map((step, index) => <li key={`${step.toolId}-${index}`}><span>{index + 1}</span><div><strong>{step.toolId}</strong><small>{JSON.stringify(step.params ?? {})}</small></div></li>)}</ol> : <p className="flixo-ai-agent-empty">{copy.empty}</p>}
          {progress && <div className="flixo-ai-agent-progress"><span>{copy.step} {progress.currentStepIndex}/{progress.totalSteps}</span><strong>{progress.currentToolId}</strong>{progress.retry ? <small>{copy.retry} {progress.retry}</small> : null}</div>}
          {error && <div className="flixo-ai-agent-error" role="alert">{error}</div>}
          {state === 'ready' && plan && <div className="flixo-ai-agent-confirm">{copy.planReady} <strong>{file ? copy.execute : copy.uploadThenExecute}</strong></div>}
          {state === 'success' && result && <div className="flixo-ai-agent-success"><strong>{copy.success}</strong><button type="button" className="primary-button" onClick={download}>{copy.download}</button></div>}
        </div>
      </div>
      <p className="flixo-ai-agent-note">{copy.safetyNote} <Link to="/admin">{copy.admin}</Link></p>
    </section>
  );
}
