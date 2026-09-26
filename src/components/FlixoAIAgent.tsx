import { useMemo, useState } from 'react';
import type { ExecutionPlan } from '@/lib/ai/planner';
import { assessCognitiveRequest } from '@/lib/agent/cognitive-orchestrator';
import type { PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { cancelPreparedExecution, confirmPreparedExecution, executePreparedExecution, prepareExecution, type PreparedExecution } from '@/lib/agent/execution-integrator';
import { TOOL_CATALOG } from '@/config/registry';
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
import { AGENT_I18N } from '@/data/agent-locales';
import type { Locale } from '@/lib/i18n';
import { type FilterMaskHandoff } from '@/tools/filter-mask/handoff';
import { askConversationalAgent } from '@/lib/agent/conversational-agent';
import { getLiveFilter } from '@/tools/filter-mask/registry';
import { resolveFilterMaskSelection } from '@/lib/intent/resolver';
import { FlixoAIAgentStudio } from './FlixoAIAgentStudio';
import './FlixoAIAgentStudio.css';

type AgentState = 'idle' | 'ready' | 'running' | 'success' | 'error';
type Message = { id: number; role: 'user' | 'agent'; text: string };
type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

const CONFIRMATIONS = /^(نعم|أيوه|ايوه|نفذ|نفّذ|ابدأ|ابدئي|موافق|تمام|yes|y|ok|okay|go|execute|run|ejecutar|exécuter|ausführen|실행|実行|jalankan|esegui|uitvoeren|wykonaj|executar|kör|ดำเนินการ|çalıştır|виконати|thực hiện)$/i;
const CANCELLATIONS = /^(لا|لأ|الغاء|إلغاء|cancel|no|n|stop)$/i;
const getDownloadFilename = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'flixo-agent-result.jpg';
  if (mimeType === 'image/png') return 'flixo-agent-result.png';
  if (mimeType === 'image/webp') return 'flixo-agent-result.webp';
  if (mimeType === 'image/svg+xml') return 'flixo-agent-result.svg';
  if (mimeType === 'text/plain') return 'flixo-agent-result.txt';
  if (mimeType === 'application/json') return 'flixo-agent-result.json';
  return 'flixo-agent-result.bin';
};

const getSaveFilePicker = (): SaveFilePicker | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
};

const saveResultToFile = async (blob: Blob): Promise<void> => {
  const showSaveFilePicker = getSaveFilePicker();
  if (!showSaveFilePicker) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getDownloadFilename(blob.type);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  const handle = await showSaveFilePicker({
    suggestedName: getDownloadFilename(blob.type),
    types: [
      {
        description: 'FLIXO result',
        accept: {
          'image/png': ['.png'],
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/webp': ['.webp'],
          'image/svg+xml': ['.svg'],
          'text/plain': ['.txt'],
          'application/json': ['.json'],
        },
      },
    ],
  });

  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
};

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
  const [preparedExecution, setPreparedExecution] = useState<PreparedExecution | null>(null);
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
  const intent = useMemo(() => contextualQuery.trim() ? findToolIntent(contextualQuery, TOOL_CATALOG.ready)[0] : null, [contextualQuery]);
  const planned = useMemo(() => {
    if (!contextualQuery.trim()) return null;
    return assessCognitiveRequest(contextualQuery).executionPlan;
  }, [contextualQuery]);
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
    const selected = getLiveFilter(nextHandoff.canonicalId);
    setFilterHandoff(nextHandoff);
    setPreparedExecution(null);
    setPlan(null);
    setState('ready');
    setError(null);
    setMemory((current) => setConversationTask(current, {
      command,
      toolId: 'filter-mask',
      planReady: false,
    }));
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
    const cognitive = assessCognitiveRequest(contextualCommand);
    if (cognitive.decision === 'NEEDS_INPUT') {
      const missing = cognitive.intentPlan.missing[0];
      const question = cognitive.clarificationQuestion?.question ?? missing?.question ?? null;
      setPreparedExecution(null);
      setPlan(null);
      setState('idle');
      setError(null);
      setMemory((current) => setConversationTask(current, {
        command: contextualCommand,
        toolId: missing?.capability ?? current.activeToolId,
        pendingToolId: missing?.capability ?? null,
        pendingQuestion: question,
        planReady: false,
      }));
      return null;
    }
    if (cognitive.decision !== 'EXECUTE_READY' || !cognitive.executionPlan) {
      setPreparedExecution(null);
      setPlan(null);
      setState('error');
      setError(cognitive.intentPlan.explanation || cognitive.semantic.reasons.join(', ') || responseCopy.noSafePlan);
      return null;
    }
    const nextPlan = cognitive.executionPlan;
    const firstStep = nextPlan.steps[0];
    setMemory((current) => setConversationTask(current, {
      command: contextualCommand,
      toolId: firstStep?.toolId ?? null,
      pendingToolId: null,
      pendingQuestion: null,
      planReady: true,
    }));
    const prepared = prepareExecution(nextPlan);
    setPlan(prepared.plan);
    setPreparedExecution(prepared);
    setState('ready'); return prepared.plan;
  };

  const runConversationalTurn = async (command: string, responseCopy = copy): Promise<boolean> => {
    try {
      const decision = await askConversationalAgent({
        locale,
        messages: [
          ...messages.slice(-23).map((message) => ({
            role: message.role === 'agent' ? 'assistant' as const : 'user' as const,
            content: message.text,
          })),
          { role: 'user' as const, content: command },
        ],
        file: file ? { name: file.name, type: file.type, size: file.size } : null,
        activePlan: plan,
        activeCommand: memory.activeCommand,
      });

      // A fallback is executable when the gateway supplied a contract-valid deterministic plan.
      // Only fall back to the legacy local path when the gateway has no usable plan.
      if (decision.fallback && !(decision.mode === 'plan' && decision.plan)) return false;

      if (decision.mode === 'plan' && decision.plan) {
        // The model is allowed to understand natural conversation and propose a plan,
        // but the parsed decision has already crossed the canonical execution-plan
        // contract: registered executable tools, valid parameters and current catalog
        // fingerprint. It still cannot execute; explicit user confirmation is required.
        const contextualCommand = contextualizeCommand(command, memory);
        const conversationalPlan = decision.plan as ExecutionPlan;

        const prepared = prepareExecution(conversationalPlan);
        setPlan(prepared.plan);
        setPreparedExecution(prepared);
        setState('ready');
        setError(null);
        setFilterHandoff(null);
        setMemory((current) => setConversationTask(current, {
          command: contextualCommand,
          toolId: conversationalPlan.steps[0]?.toolId ?? null,
          planReady: true,
        }));
        pushMessage(
          'agent',
          file
            ? `${decision.reply} ${responseCopy.execute}`
            : `${decision.reply} ${responseCopy.uploadThenExecute}`,
        );
        return true;
      }

      setPreparedExecution(null);
      setPlan(null);
      setError(null);
      setState('idle');
      setFilterHandoff(null);

      if (decision.mode === 'clarify') {
        setMemory((current) => setConversationTask(current, {
          command,
          toolId: current.activeToolId,
          pendingQuestion: decision.question,
          planReady: false,
        }));
        pushMessage('agent', decision.reply);
        if (decision.question && decision.question.trim() !== decision.reply.trim()) {
          pushMessage('agent', decision.question);
        }
        return true;
      }

      setMemory((current) => setConversationTask(current, {
        command: current.activeCommand ?? command,
        toolId: current.activeToolId,
        planReady: false,
      }));
      pushMessage('agent', decision.reply);
      return true;
    } catch {
      return false;
    }
  };

  const execute = async (prepared = preparedExecution, responseCopy = copy) => {
    if (!file || !prepared) return;
    setState('running'); setError(null);
    setMemory((current) => setConversationTask(current, { command: current.activeCommand ?? '', planReady: false }));
    pushMessage('agent', `${responseCopy.success} ${prepared.plan.steps.length} ${responseCopy.step}.`);
    const confirmed = confirmPreparedExecution(prepared);
    setPreparedExecution(confirmed);
    try {
      const result = await executePreparedExecution(confirmed, file, setProgress);
      setResult(result.output); setState('success');
      pushMessage('agent', responseCopy.success);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Execution failed.';
      setError(message); setState('error');
      pushMessage('agent', `${responseCopy.stopped} ${message}`);
    }
  };
  const sendMessage = async () => {
    const command = query.trim();
    if (!command || state === 'running') return;

    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command);
    setQuery('');

    if (CONFIRMATIONS.test(command) && preparedExecution) {
      if (!file) {
        setError(responseCopy.needImage);
        pushMessage('agent', responseCopy.planReadyNoFile);
        setState('error');
        return;
      }
      await execute(preparedExecution, responseCopy);
      return;
    }

    if (CANCELLATIONS.test(command)) {
      if (preparedExecution) {
        try { cancelPreparedExecution(preparedExecution); } catch { /* keep cancellation fail-closed */ }
      }
      setPreparedExecution(null);
      setPlan(null);
      setState('idle');
      setError(null);
      setMemory((current) => clearConversationTask(current));
      setFilterHandoff(null);
      pushMessage('agent', responseCopy.cancelled);
      return;
    }

    if (filterMaskMatch && applyFilterMaskHandoff(command, detectedLocale)) return;

    if (await runConversationalTurn(command, responseCopy)) return;

    const conversationKind = classifyConversation(command);
    const naturalReply = conversationalReply(conversationKind, responseCopy);
    if (naturalReply) {
      setPlan(null);
      setPreparedExecution(null);
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
      setPreparedExecution(null);
      setState('idle');
      setError(null);
      pushMessage('agent', detectedLocale === 'ar'
        ? 'مفهوم. سنقص الصورة. ما النسبة أو الأبعاد؟ يمكنك الرد فقط بـ «مربع» أو «1:1» أو «1200×800».'
        : 'Got it. We will crop the image. What ratio or dimensions do you want? You can simply reply “square”, “1:1”, or “1200×800”.');
      return;
    }

    const nextPlan = buildPlan(command, responseCopy);
    if (!nextPlan) {
      const latestMemory = loadConversationMemory();
      const pendingQuestion = latestMemory.pendingQuestion;
      pushMessage('agent', pendingQuestion ?? responseCopy.clarification);
      return;
    }

    if (!file) {
      pushMessage('agent', responseCopy.planReadyNoFile);
      return;
    }

    pushMessage('agent', responseCopy.understood);
  };

  const prepare = async () => {
    const command = query.trim(); if (!command) return;
    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command); setQuery('');
    if (filterMaskMatch && applyFilterMaskHandoff(command, detectedLocale)) return;
    if (await runConversationalTurn(command, responseCopy)) return;
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

  return (
    <FlixoAIAgentStudio
      locale={locale}
      copy={copy}
      messages={messages}
      query={query}
      setQuery={setQuery}
      file={file}
      onFileChange={(nextFile) => {
        setFile(nextFile);
        setPlan(null);
        setPreparedExecution(null);
        setResult(null);
        setState('idle');
        setError(null);
        setProgress(null);
      }}
      state={state}
      sendMessage={sendMessage}
      prepare={prepare}
      intent={intent}
      plan={plan}
      planned={planned}
      progress={progress}
      error={error}
      result={result}
      filterHandoff={filterHandoff}
      tools={TOOL_CATALOG.ready}
      onDownload={() => {
        if (!result) return;
        void saveResultToFile(result).catch((cause) => {
          const message = cause instanceof Error ? cause.message : 'Unable to save the result file.';
          setError(message);
          setState('error');
        });
      }}
    />
  );
}
