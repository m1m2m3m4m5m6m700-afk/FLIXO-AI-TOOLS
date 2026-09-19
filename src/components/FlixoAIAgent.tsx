import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { planFromIntent, type ExecutionPlan } from '@/lib/ai/planner';
import { runWorkflowPipeline, type PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { getReadyToolConfigs } from '@/config/tools';
import { findToolIntent } from '@/lib/intent-router';
import { extractParameters } from '@/lib/agent/intent/parameter-extractor';
import { detectAgentLocale } from '@/lib/agent/language-detector';
import { AGENT_I18N } from '@/data/agent-locales';
import type { Locale } from '@/lib/i18n';
import './FlixoAIAgent.css';

type AgentState = 'idle' | 'ready' | 'running' | 'success' | 'error';
type Message = { id: number; role: 'user' | 'agent'; text: string };

const CONFIRMATIONS = /^(نعم|أيوه|ايوه|نفذ|نفّذ|ابدأ|ابدئي|موافق|تمام|yes|y|ok|okay|go|execute|run|ejecutar|exécuter|ausführen|실행|実行|jalankan|esegui|uitvoeren|wykonaj|executar|kör|ดำเนินการ|çalıştır|виконати|thực hiện)$/i;
const CANCELLATIONS = /^(لا|لأ|الغاء|إلغاء|cancel|no|n|stop)$/i;
const CAPABILITY_QUESTIONS = /(?:\b(?:ما|ماذا|ما هي|ما الذي|ايه|إيه|اذكر|أذكر)\b.*\b(?:أدوات|ادوات)\b)|(?:\b(?:ما|ماذا)\b.*\b(?:تستطيع|تسطيع|تقدر|يمكنك)\b.*\b(?:تنفيذ|تعمل|تفعل)\b)|(?:what\s+(?:can\s+you\s+do|tools\s+can\s+you\s+use)|capabilities)/i;
const GENERIC_CROP_REQUEST = /(?:^|\s)(?:(?:أريد|اريد|ممكن|هل\s+تستطيع|please)\s+)?(?:قص|اقت(?:ص|طع)|crop)(?:\s+(?:صورة|الصور|الصورة|image|photo))?\s*$/i;
const EXECUTABLE_TOOL_NAMES: Record<Locale, readonly string[]> = {
  en: ['background removal', 'image upscaling', 'image cropping/resizing', 'image compression', 'image format conversion', 'image effects'],
  ar: ['إزالة الخلفية', 'تكبير وتحسين الصورة', 'قص وتغيير أبعاد الصورة', 'ضغط الصورة', 'تحويل صيغة الصورة', 'تأثيرات وتحسينات الصورة'],
  es: ['eliminar fondo', 'mejorar resolución', 'recortar/redimensionar', 'comprimir', 'convertir formato', 'efectos de imagen'],
  fr: ['suppression de fond', 'amélioration de résolution', 'recadrage/redimensionnement', 'compression', 'conversion de format', 'effets d’image'],
  de: ['Hintergrund entfernen', 'Bild hochskalieren', 'Zuschneiden/Größe ändern', 'Komprimieren', 'Format konvertieren', 'Bildeffekte'],
  hi: ['background removal', 'image upscaling', 'cropping/resizing', 'compression', 'format conversion', 'image effects'],
  id: ['menghapus latar', 'meningkatkan resolusi', 'memotong/mengubah ukuran', 'kompresi', 'konversi format', 'efek gambar'],
  it: ['rimozione sfondo', 'aumento risoluzione', 'ritaglio/ridimensionamento', 'compressione', 'conversione formato', 'effetti immagine'],
  ja: ['背景削除', '画像拡大', '切り抜き/リサイズ', '圧縮', '形式変換', '画像効果'],
  ko: ['배경 제거', '이미지 확대', '자르기/크기 조정', '압축', '형식 변환', '이미지 효과'],
  ms: ['buang latar belakang', 'tingkatkan resolusi', 'pangkas/ubah saiz', 'mampatkan', 'tukar format', 'kesan imej'],
  nl: ['achtergrond verwijderen', 'opschalen', 'bijsnijden/resize', 'comprimeren', 'formaat converteren', 'afbeeldingseffecten'],
  pl: ['usuwanie tła', 'zwiększanie rozdzielczości', 'przycinanie/zmiana rozmiaru', 'kompresja', 'konwersja formatu', 'efekty obrazu'],
  pt: ['remoção de fundo', 'aumento de resolução', 'recorte/redimensionamento', 'compressão', 'conversão de formato', 'efeitos de imagem'],
  ru: ['удаление фона', 'увеличение изображения', 'кадрирование/изменение размера', 'сжатие', 'конвертация формата', 'эффекты изображения'],
  sv: ['ta bort bakgrund', 'skala upp', 'beskära/ändra storlek', 'komprimera', 'konvertera format', 'bild effekter'],
  th: ['ลบพื้นหลัง', 'ขยายภาพ', 'ครอป/ปรับขนาด', 'บีบอัด', 'แปลงรูปแบบ', 'เอฟเฟกต์ภาพ'],
  tr: ['arka plan kaldırma', 'görüntü büyütme', 'kırpma/boyutlandırma', 'sıkıştırma', 'format dönüştürme', 'görüntü efektleri'],
  uk: ['видалення фону', 'збільшення зображення', 'обрізання/зміна розміру', 'стиснення', 'конвертація формату', 'ефекти зображення'],
  vi: ['xóa nền', 'tăng độ phân giải', 'cắt/chỉnh kích thước', 'nén ảnh', 'chuyển đổi định dạng', 'hiệu ứng ảnh'],
};
const capabilityReply = (responseCopy: typeof AGENT_I18N.en, detectedLocale: Locale) => {
  const names = EXECUTABLE_TOOL_NAMES[detectedLocale] ?? EXECUTABLE_TOOL_NAMES.en;
  return detectedLocale === 'ar'
    ? `أستطيع تنفيذ ${names.length} عمليات محلية مباشرة: ${names.join('، ')}. أرسل الصورة واذكر النتيجة المطلوبة.`
    : `${responseCopy.understood} Available local operations: ${names.join(', ')}.`;
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
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: 'agent', text: copy.greeting }]);
  const [messageId, setMessageId] = useState(2);

  const intent = useMemo(() => query.trim() ? findToolIntent(query, getReadyToolConfigs())[0] : null, [query]);
  const planned = useMemo(() => query.trim() ? planFromIntent(query) : null, [query]);
  const pushMessage = (role: Message['role'], text: string) => { setMessages((current) => [...current, { id: messageId, role, text }]); setMessageId((value) => value + 1); };

  const buildPlan = (command: string, responseCopy = copy): ExecutionPlan | null => {
    setError(null); setResult(null); setProgress(null);
    const extracted = extractParameters(command);
    if (!extracted.success) { setPlan(null); setState('error'); setError(extracted.errors.join(' ')); return null; }
    const nextPlan = planFromIntent(command);
    if (!nextPlan) { setPlan(null); setState('error'); setError(responseCopy.noSafePlan); return null; }
    setPlan(nextPlan); setState('ready'); return nextPlan;
  };

  const execute = async (nextPlan = plan, responseCopy = copy) => {
    if (!file || !nextPlan) return;
    setState('running'); setError(null);
    pushMessage('agent', `${responseCopy.success} ${nextPlan.steps.length} ${responseCopy.step}.`);
    try { const output = await runWorkflowPipeline(file, nextPlan, setProgress); setResult(output); setState('success'); pushMessage('agent', responseCopy.success); }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Execution failed.'; setError(message); setState('error'); pushMessage('agent', `${responseCopy.stopped} ${message}`); }
  };

  const sendMessage = async () => {
    const command = query.trim(); if (!command || state === 'running') return;
    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command); setQuery('');
    if (CAPABILITY_QUESTIONS.test(command)) {
      setPlan(null); setState('idle'); setError(null);
      pushMessage('agent', capabilityReply(responseCopy, detectedLocale));
      return;
    }
    if (GENERIC_CROP_REQUEST.test(command)) {
      setPlan(null); setState('idle'); setError(null);
      pushMessage('agent', detectedLocale === 'ar'
        ? 'نعم. أستطيع قص الصورة. ارفع الصورة وحدد النسبة مثل 1:1 أو الأبعاد مثل 1200×800، وسأجهز خطة القص قبل التنفيذ.'
        : 'Yes. I can crop images. Upload the image and give an aspect ratio such as 1:1 or dimensions such as 1200×800; I will prepare the crop plan before execution.');
      return;
    }
    if (CONFIRMATIONS.test(command) && plan) {
      if (!file) { setError(responseCopy.needImage); pushMessage('agent', responseCopy.planReadyNoFile); setState('error'); return; }
      await execute(plan, responseCopy); return;
    }
    if (CANCELLATIONS.test(command)) { setPlan(null); setState('idle'); setError(null); pushMessage('agent', responseCopy.cancelled); return; }
    const nextPlan = buildPlan(command, responseCopy);
    if (!nextPlan) { pushMessage('agent', responseCopy.clarification); return; }
    if (!file) { pushMessage('agent', responseCopy.planReadyNoFile); return; }
    pushMessage('agent', responseCopy.understood);
  };

  const prepare = () => {
    const command = query.trim(); if (!command) return;
    const detectedLocale = detectAgentLocale(command, locale);
    const responseCopy = AGENT_I18N[detectedLocale] ?? copy;
    pushMessage('user', command); setQuery('');
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
          <textarea id="flixo-agent-command" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={copy.placeholder} rows={3} />
          <div className="flixo-ai-agent-examples" aria-label={copy.examplesLabel}>{copy.examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)}>{example}</button>)}</div>
          <label htmlFor="flixo-agent-file">{copy.fileLabel}</label>
          <input id="flixo-agent-file" type="file" accept="image/*" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setState('idle'); setError(null); }} />
          <div className="flixo-ai-agent-actions"><button type="button" className="primary-button" onClick={() => void sendMessage()} disabled={!query.trim() || state === 'running'}>{copy.send}</button><button type="button" className="primary-button" onClick={prepare} disabled={!query.trim() || state === 'running'}>{copy.analyze}</button></div>
        </div>
        <div className="flixo-ai-agent-plan">
          <div className="flixo-ai-agent-plan-topline"><strong>{copy.thinking}</strong><span>{state === 'running' ? copy.executing : state === 'success' ? copy.completed : state === 'error' ? copy.needsAttention : copy.planReady}</span></div>
          {intent && <div className="flixo-ai-agent-intent">{copy.nearestTool} <strong>{intent.tool.title}</strong> · {intent.score}%</div>}
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
