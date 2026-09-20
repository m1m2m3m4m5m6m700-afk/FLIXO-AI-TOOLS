import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { buildIntentPlan } from '@/lib/agent/intent/intent-plan';
import { planFromIntent, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { getReadyToolConfigs } from '@/config/tools';
import { findToolIntent } from '@/lib/intent-router';
import { detectAgentLocale } from '@/lib/agent/language-detector';
import {
  classifyConversation,
  contextualizeCommand,
  loadConversationMemory,
  rememberTurn,
  setConversationTask,
  clearConversationTask,
  type ConversationMemory,
} from '@/lib/agent/conversation';
import {
  assertExecutionAllowed,
  cancelTask,
  confirmTask,
  createTaskContext,
  interpretConfirmation,
  transitionTask,
  type TaskContext,
} from '@/lib/agent/task-state';
import { AGENT_I18N } from '@/data/agent-locales';
import type { Locale } from '@/lib/i18n';
import './FlixoAIAgent.css';

type AgentState = 'idle' | 'ready' | 'running' | 'success' | 'error';
type Message = { id: number; role: 'user' | 'agent'; text: string };
type BuildPlanResult = Readonly<{
  plan: ExecutionPlan | null;
  question: string | null;
}>;

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
  const [intentPlan, setIntentPlan] = useState<ReturnType<typeof buildIntentPlan> | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskContext, setTaskContext] = useState<TaskContext | null>(null);
  const [memory, setMemory] = useState<ConversationMemory>(() => loadConversationMemory());
  const [messages, setMessages] = useState<Message[]>(() => {
    const turns = loadConversationMemory().turns;
    if (turns.length === 0) return [{ id: 1, role: 'agent', text: copy.greeting }];
    return turns.map((turn, index) => ({ id: index + 1, role: turn.role, text: turn.text }));
  });
  const [messageId, setMessageId] = useState(() => loadConversationMemory().turns.length + 1);

  const contextualQuery = useMemo(() => contextualizeCommand(query, memory), [query, memory]);
  const intent = useMemo(
    () => contextualQuery.trim() ? findToolIntent(contextualQuery, getReadyToolConfigs())[0] : null,
    [contextualQuery],
  );
  const plannedIntent = useMemo(
    () => contextualQuery.trim() ? buildIntentPlan(contextualQuery) : null,
    [contextualQuery],
  );
  const pushMessage = (role: Message['role'], text: string) => {
    setMessages((current) => [...current, { id: messageId, role, text }]);
    setMessageId((value) => value + 1);
    setMemory((current) => rememberTurn(current, { role, text }));
  };

  const resetTaskState = () => {
    setPlan(null);
    setIntentPlan(null);
    setProgress(null);
    setTaskContext(null);
  };

  const buildPlan = (command: string): BuildPlanResult => {
    setError(null);
    setResult(null);
    setProgress(null);

    const contextualCommand = contextualizeCommand(command, memory);
    const nextIntentPlan = buildIntentPlan(contextualCommand);
    setIntentPlan(nextIntentPlan);

    if (nextIntentPlan.status === 'NEEDS_INPUT') {
      setPlan(null);
      setState('idle');
      const question = nextIntentPlan.missing[0]?.question ?? null;
      setMemory((current) => setConversationTask(current, {
        command: contextualCommand,
        toolId: nextIntentPlan.intent.id,
        pendingToolId: nextIntentPlan.missing[0]?.capability ?? null,
        pendingQuestion: question,
        planReady: false,
      }));
      return { plan: null, question };
    }

    if (nextIntentPlan.status !== 'READY') {
      setPlan(null);
      setState('error');
      setError(nextIntentPlan.explanation);
      return { plan: null, question: null };
    }

    const nextPlan = planFromIntent(contextualCommand);
    if (!nextPlan) {
      setPlan(null);
      setState('error');
      setError('The validated IntentPlan could not be projected into the execution plan.');
      return { plan: null, question: null };
    }

    let nextTask = createTaskContext();
    nextTask = transitionTask(nextTask, 'PLANNED');
    nextTask = transitionTask(nextTask, 'AWAITING_CONFIRMATION');
    const boundIntentPlan = buildIntentPlan(contextualCommand, {
      taskId: nextTask.taskId,
      traceId: nextTask.traceId,
    });

    setTaskContext(nextTask);
    setIntentPlan(boundIntentPlan);
    setPlan(nextPlan);
    setState('ready');
    setMemory((current) => setConversationTask(current, {
      command: contextualCommand,
      toolId: nextIntentPlan.intent.id,
      planReady: true,
    }));
    return { plan: nextPlan, question: null };
  };

  const execute = async (nextPlan = plan, responseCopy = copy) => {
    if (!file || !nextPlan || !taskContext) return;
    setState('running');
    setError(null);

    try {
      const confirmed = confirmTask(taskContext);
      assertExecutionAllowed(confirmed);
      const verifying = transitionTask(confirmed, 'VERIFYING');
      setTaskContext(verifying);
      setMemory((current) => setConversationTask(current, {
        command: current.activeCommand ?? '',
        planReady: false,
      }));

      pushMessage('agent', responseCopy.success + ' ' + nextPlan.steps.length + ' ' + responseCopy.step + '.');
      const output = await runWorkflowPipeline(file, nextPlan, setProgress);
      const completed = transitionTask(verifying, 'COMPLETED');
      setTaskContext(completed);
      setResult(output);
      setState('success');
      pushMessage('agent', responseCopy.success);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Execution failed.';
      setTaskContext((current) => {
        if (!current) return current;
        if (current.state === 'VERIFYING') return transitionTask(current, 'FAILED');
        if (current.state === 'EXECUTING') return transitionTask(current, 'FAILED');
        return current;
      });
      setError(message);
      setState('error');
      pushMessage('agent', responseCopy.stopped + ' ' + message);
    }
  };

  const sendMessage = async () => {
    const command = query.trim();
    if (!command || state === 'running') return;

    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command);
    setQuery('');

    const confirmation = interpretConfirmation(command);
    if (confirmation === 'CONFIRM' && plan && taskContext?.state === 'AWAITING_CONFIRMATION') {
      if (!file) {
        setError(responseCopy.needImage);
        pushMessage('agent', responseCopy.planReadyNoFile);
        setState('error');
        return;
      }
      await execute(plan, responseCopy);
      return;
    }

    if (confirmation === 'CANCEL') {
      setPlan(null);
      setIntentPlan(null);
      setState('idle');
      setError(null);
      setTaskContext((current) => current ? cancelTask(current) : null);
      setMemory((current) => clearConversationTask(current));
      pushMessage('agent', responseCopy.cancelled);
      return;
    }

    const conversationKind = classifyConversation(command);
    const naturalReply = conversationalReply(conversationKind, responseCopy);
    if (naturalReply) {
      resetTaskState();
      setState('idle');
      setError(null);
      pushMessage('agent', naturalReply);
      return;
    }

    const built = buildPlan(command);
    if (!built.plan) {
      pushMessage('agent', built.question ?? responseCopy.clarification);
      return;
    }

    if (!file) {
      pushMessage('agent', responseCopy.planReadyNoFile);
      return;
    }

    pushMessage('agent', responseCopy.understood);
  };

  const prepare = () => {
    const command = query.trim();
    if (!command) return;
    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command);
    setQuery('');

    const naturalReply = conversationalReply(classifyConversation(command), responseCopy);
    if (naturalReply) {
      pushMessage('agent', naturalReply);
      return;
    }

    const built = buildPlan(command);
    if (built.question) {
      pushMessage('agent', built.question);
      return;
    }
    if (built.plan) {
      pushMessage(
        'agent',
        file
          ? responseCopy.planReady + ' ' + responseCopy.execute
          : responseCopy.planReady + ' ' + responseCopy.uploadThenExecute,
      );
    } else if (intentPlan?.explanation) {
      pushMessage('agent', intentPlan.explanation);
    }
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'flixo-agent-' + Date.now() + '.' + (
      result.type.includes('jpeg') ? 'jpg' :
      result.type.includes('png') ? 'png' : 'webp'
    );
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flixo-ai-agent" aria-labelledby="flixo-ai-agent-title">
      <div className="flixo-ai-agent-glow" aria-hidden="true" />
      <div className="flixo-ai-agent-header">
        <div>
          <span className="image-tool-eyebrow">FLIXO AI AGENT</span>
          <h2 id="flixo-ai-agent-title">{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>
        <span className="flixo-ai-agent-badge">{copy.badge}</span>
      </div>

      <div className="flixo-ai-agent-chat" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={'flixo-ai-agent-message ' + message.role}>
            <span className="flixo-ai-agent-avatar">{message.role === 'agent' ? 'F' : 'U'}</span>
            <div>{message.text}</div>
          </div>
        ))}
      </div>

      <div className="flixo-ai-agent-grid">
        <div className="flixo-ai-agent-inputs">
          <label htmlFor="flixo-agent-command">{copy.commandLabel}</label>
          <input
            id="flixo-agent-command"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={copy.placeholder}
            autoComplete="off"
          />

          <div className="flixo-ai-agent-examples" aria-label={copy.examplesLabel}>
            {copy.examples.map((example) => (
              <button key={example} type="button" onClick={() => setQuery(example)}>
                {example}
              </button>
            ))}
          </div>

          <label htmlFor="flixo-agent-file">{copy.fileLabel}</label>
          <input
            id="flixo-agent-file"
            type="file"
            accept="image/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setState('idle');
              setError(null);
            }}
          />

          <div className="flixo-ai-agent-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void sendMessage()}
              disabled={!query.trim() || state === 'running'}
            >
              {copy.send}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={prepare}
              disabled={!query.trim() || state === 'running'}
            >
              {copy.analyze}
            </button>
          </div>
        </div>

        <div className="flixo-ai-agent-plan">
          <div className="flixo-ai-agent-plan-topline">
            <strong>{copy.thinking}</strong>
            <span>
              {state === 'running'
                ? copy.executing
                : state === 'success'
                  ? copy.completed
                  : state === 'error'
                    ? copy.needsAttention
                    : copy.planReady}
            </span>
          </div>

          {intent && (
            <div className="flixo-ai-agent-intent">
              {copy.nearestTool} <strong>{intent.tool.title}</strong> · {intent.score}%
            </div>
          )}

          {plannedIntent?.status === 'NEEDS_INPUT' && plannedIntent.missing[0] && (
            <div className="flixo-ai-agent-confirm">
              <strong>{plannedIntent.missing[0].question}</strong>
              <small>{plannedIntent.missing[0].examples.join(' · ')}</small>
            </div>
          )}

          {plannedIntent?.status === 'READY' && plannedIntent.steps.length > 0 ? (
            <ol>
              {plannedIntent.steps.map((step, index) => (
                <li key={step.toolId + '-' + index}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.toolId}</strong>
                    <small>{JSON.stringify(step.params ?? {})}</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            !plannedIntent?.missing.length && (
              <p className="flixo-ai-agent-empty">{copy.empty}</p>
            )
          )}

          {progress && (
            <div className="flixo-ai-agent-progress">
              <span>{copy.step} {progress.currentStepIndex}/{progress.totalSteps}</span>
              <strong>{progress.currentToolId}</strong>
              {progress.retry ? <small>{copy.retry} {progress.retry}</small> : null}
            </div>
          )}

          {error && <div className="flixo-ai-agent-error" role="alert">{error}</div>}

          {state === 'ready' && plan && taskContext?.state === 'AWAITING_CONFIRMATION' && (
            <div className="flixo-ai-agent-confirm">
              {copy.planReady} <strong>{file ? copy.execute : copy.uploadThenExecute}</strong>
            </div>
          )}

          {state === 'success' && result && (
            <div className="flixo-ai-agent-success">
              <strong>{copy.success}</strong>
              <button type="button" className="primary-button" onClick={download}>
                {copy.download}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="flixo-ai-agent-note">
        {copy.safetyNote} <Link to="/admin">{copy.admin}</Link>
      </p>
    </section>
  );
}
