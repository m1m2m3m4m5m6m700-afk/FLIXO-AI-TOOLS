import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { planFromIntent, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { getReadyToolConfigs } from '@/config/tools';
import { findToolIntent } from '@/lib/intent-router';
import { extractParameters } from '@/lib/agent/intent/parameter-extractor';
import './FlixoAIAgent.css';

type AgentState = 'idle' | 'ready' | 'running' | 'success' | 'error';
type Message = { id: number; role: 'user' | 'agent'; text: string };

const examples = [
  'اضغط الصورة إلى أقل من 200 كيلوبايت وحولها WebP',
  'أزل الخلفية واجعل الصورة مربعة',
  'resize to 1200x800',
];

const CONFIRMATIONS = /^(نعم|أيوه|ايوه|نفذ|نفّذ|ابدأ|ابدئي|موافق|تمام|yes|y|ok|okay|go|execute|run)$/i;
const CANCELLATIONS = /^(لا|لأ|الغاء|إلغاء|cancel|no|n|stop)$/i;

export function FlixoAIAgent() {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<AgentState>('idle');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'agent', text: 'مرحبًا 👋 أنا وكيل FLIXO. صف لي النتيجة التي تريدها، وسأختار الأدوات المحلية المناسبة، أشرح الخطة، ثم أطلب تأكيدك قبل التنفيذ.' },
  ]);
  const [messageId, setMessageId] = useState(2);

  const intent = useMemo(() => query.trim() ? findToolIntent(query, getReadyToolConfigs())[0] : null, [query]);
  const planned = useMemo(() => query.trim() ? planFromIntent(query) : null, [query]);

  const pushMessage = (role: Message['role'], text: string) => {
    setMessages((current) => [...current, { id: messageId, role, text }]);
    setMessageId((value) => value + 1);
  };

  const buildPlan = (command: string): ExecutionPlan | null => {
    setError(null);
    setResult(null);
    setProgress(null);
    const extracted = extractParameters(command);
    if (!extracted.success) {
      setPlan(null);
      setState('error');
      setError(extracted.errors.join(' '));
      return null;
    }
    const nextPlan = planFromIntent(command);
    if (!nextPlan) {
      setPlan(null);
      setState('error');
      setError('فهمت جزءًا من الطلب، لكن لا توجد خطة محلية آمنة لتنفيذه بالكامل.');
      return null;
    }
    setPlan(nextPlan);
    setState('ready');
    return nextPlan;
  };

  const execute = async (nextPlan = plan) => {
    if (!file || !nextPlan) return;
    setState('running');
    setError(null);
    pushMessage('agent', `ممتاز. سأستخدم ${nextPlan.steps.length} ${nextPlan.steps.length === 1 ? 'أداة محلية' : 'أدوات محلية'} بالترتيب الظاهر أمامك. لا يتم إرسال الصورة أو البيانات خارج المتصفح.`);
    try {
      const output = await runWorkflowPipeline(file, nextPlan, setProgress);
      setResult(output);
      setState('success');
      pushMessage('agent', 'تم التنفيذ بنجاح والتحقق من الناتج. يمكنك الآن تنزيل الملف الناتج أو إعطائي أمرًا آخر على نفس الصورة.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'تعذر تنفيذ الأمر.';
      setError(message);
      setState('error');
      pushMessage('agent', `توقفت العملية بأمان: ${message}`);
    }
  };

  const sendMessage = async () => {
    const command = query.trim();
    if (!command || state === 'running') return;
    pushMessage('user', command);
    setQuery('');

    if (CONFIRMATIONS.test(command) && plan) {
      if (!file) {
        setError('أحتاج إلى صورة قبل التنفيذ. ارفع الصورة أولًا ثم قل «نفّذ».');
        pushMessage('agent', 'الخطة جاهزة، لكن لا توجد صورة مرفوعة بعد. ارفع الصورة ثم قل «نفّذ».');
        setState('error');
        return;
      }
      await execute(plan);
      return;
    }

    if (CANCELLATIONS.test(command)) {
      setPlan(null);
      setState('idle');
      setError(null);
      pushMessage('agent', 'تم إلغاء الخطة. لن أنفذ أي أداة. أخبرني بأمر جديد عندما تكون جاهزًا.');
      return;
    }

    const nextPlan = buildPlan(command);
    if (!nextPlan) {
      pushMessage('agent', 'أحتاج توضيحًا قبل التنفيذ. أخبرني مثلًا بالصيغة المطلوبة، الحجم المستهدف، الأبعاد أو العملية التي تريدها.');
      return;
    }

    if (!file) {
      pushMessage('agent', 'فهمت المطلوب وبنيت خطة آمنة. ارفع الصورة الآن، وبعدها سأعرض لك الخطوات وأطلب تأكيد التنفيذ.');
      return;
    }

    pushMessage('agent', `فهمت طلبك. وجدت ${nextPlan.steps.length} خطوة قابلة للتنفيذ محليًا. راجع الخطة ثم قل «نفّذ» عندما تريد البدء.`);
  };

  const prepare = () => {
    const command = query.trim();
    if (!command) return;
    pushMessage('user', command);
    setQuery('');
    const nextPlan = buildPlan(command);
    if (nextPlan) {
      pushMessage('agent', file ? 'الخطة جاهزة. راجعها، ثم قل «نفّذ» وسأبدأ.' : 'الخطة جاهزة. ارفع الصورة ثم قل «نفّذ» وسأبدأ.');
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
          <h2 id="flixo-ai-agent-title">وكيل يفهمك ويتعامل مع أدوات FLIXO.</h2>
          <p>تحدث معه طبيعيًا. سيحوّل طلبك إلى خطة من الأدوات المحلية المسموح بها، يطلب التوضيح عند الحاجة، ثم ينفذ بعد موافقتك.</p>
        </div>
        <span className="flixo-ai-agent-badge">LOCAL TOOLS ONLY</span>
      </div>

      <div className="flixo-ai-agent-chat" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`flixo-ai-agent-message ${message.role}`}>
            <span className="flixo-ai-agent-avatar">{message.role === 'agent' ? 'F' : 'أ'}</span>
            <div>{message.text}</div>
          </div>
        ))}
      </div>

      <div className="flixo-ai-agent-grid">
        <div className="flixo-ai-agent-inputs">
          <label htmlFor="flixo-agent-command">تحدث مع الوكيل</label>
          <textarea
            id="flixo-agent-command"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
            placeholder="مثال: جهز هذه الصورة للمتجر، WebP وأقل من 200KB ومربعة"
            rows={3}
          />
          <div className="flixo-ai-agent-examples" aria-label="أمثلة">
            {examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)}>{example}</button>)}
          </div>
          <label htmlFor="flixo-agent-file">ملف العمل</label>
          <input id="flixo-agent-file" type="file" accept="image/*" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setState('idle'); setError(null); }} />
          <div className="flixo-ai-agent-actions">
            <button type="button" className="primary-button" onClick={() => void sendMessage()} disabled={!query.trim() || state === 'running'}>إرسال</button>
            <button type="button" className="primary-button" onClick={prepare} disabled={!query.trim() || state === 'running'}>تحليل الخطة</button>
          </div>
        </div>

        <div className="flixo-ai-agent-plan">
          <div className="flixo-ai-agent-plan-topline"><strong>تفكير الوكيل التنفيذي</strong><span>{state === 'running' ? 'جارٍ التنفيذ…' : state === 'success' ? 'اكتمل' : state === 'error' ? 'يحتاج تدخلًا' : 'جاهز'}</span></div>
          {intent && <div className="flixo-ai-agent-intent">الأداة الأقرب: <strong>{intent.tool.title}</strong> · {intent.score}%</div>}
          {planned?.steps?.length ? <ol>{planned.steps.map((step, index) => <li key={`${step.toolId}-${index}`}><span>{index + 1}</span><div><strong>{step.toolId}</strong><small>{JSON.stringify(step.params ?? {})}</small></div></li>)}</ol> : <p className="flixo-ai-agent-empty">سأعرض هنا الأدوات التي سأستخدمها قبل التنفيذ.</p>}
          {progress && <div className="flixo-ai-agent-progress"><span>الخطوة {progress.currentStepIndex}/{progress.totalSteps}</span><strong>{progress.currentToolId}</strong>{progress.retry ? <small>إعادة المحاولة {progress.retry}</small> : null}</div>}
          {error && <div className="flixo-ai-agent-error" role="alert">{error}</div>}
          {state === 'ready' && plan && <div className="flixo-ai-agent-confirm">الخطة جاهزة. <strong>{file ? 'قل «نفّذ» للبدء.' : 'ارفع الصورة ثم قل «نفّذ».'}</strong></div>}
          {state === 'success' && result && <div className="flixo-ai-agent-success"><strong>تم التنفيذ والتحقق من الناتج.</strong><button type="button" className="primary-button" onClick={download}>تنزيل النتيجة</button></div>}
        </div>
      </div>
      <p className="flixo-ai-agent-note">حدود الوكيل صارمة: لا ينفذ إلا الأدوات المحلية القابلة للتنفيذ، ولا يتجاوز Capability Registry أو قيود السلامة. <Link to="/admin">لوحة الإدارة</Link></p>
    </section>
  );
}
