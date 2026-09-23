import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import type { ExecutionPlan } from '@/lib/ai/planner';
import type { PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { LOCALES, type Locale } from '@/lib/i18n';
import type { FilterMaskHandoff } from '@/tools/filter-mask/handoff';
import type { AGENT_I18N } from '@/data/agent-locales';

export type FlixoAgentStudioMessage = Readonly<{ id: number; role: 'user' | 'agent'; text: string }>;
export type FlixoAgentStudioTool = Readonly<{ id: string; title: string; description: string; category?: string }>;

type Copy = typeof AGENT_I18N.en;

type Props = Readonly<{
  locale: Locale;
  copy: Copy;
  messages: readonly FlixoAgentStudioMessage[];
  query: string;
  setQuery: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  state: 'idle' | 'ready' | 'running' | 'success' | 'error';
  sendMessage: () => void | Promise<void>;
  prepare: () => void | Promise<void>;
  intent?: { tool?: { title?: string }; score?: number } | null;
  plan: ExecutionPlan | null;
  planned: ExecutionPlan | null;
  progress: PipelineProgress | null;
  error: string | null;
  result: Blob | null;
  onDownload: () => void;
  filterHandoff: FilterMaskHandoff | null;
  tools: readonly FlixoAgentStudioTool[];
}>;

const LANGUAGE_LABELS: Readonly<Record<Locale, string>> = {
  ar: 'العربية', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी',
  id: 'Bahasa Indonesia', it: 'Italiano', ja: '日本語', ko: '한국어', ms: 'Bahasa Melayu',
  nl: 'Nederlands', pl: 'Polski', pt: 'Português', ru: 'Русский', sv: 'Svenska',
  th: 'ไทย', tr: 'Türkçe', uk: 'Українська', vi: 'Tiếng Việt',
};

const classifyTool = (tool: FlixoAgentStudioTool): 'image' | 'video' | 'filter' => {
  const id = tool.id.toLowerCase();
  const title = tool.title.toLowerCase();
  if (id.includes('filter') || title.includes('filter') || title.includes('فلتر')) return 'filter';
  if (tool.category?.toLowerCase().includes('video') || id.includes('video')) return 'video';
  return 'image';
};

export function FlixoAIAgentStudio({
  locale,
  copy,
  messages,
  query,
  setQuery,
  file,
  onFileChange,
  state,
  sendMessage,
  prepare,
  intent,
  plan,
  planned,
  progress,
  error,
  result,
  onDownload,
  filterHandoff,
  tools,
}: Props) {
  const navigate = useNavigate();
  const [toolSearch, setToolSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'image' | 'video' | 'filter'>('all');
  const normalizedSearch = toolSearch.trim().toLowerCase();

  const filteredTools = useMemo(
    () => tools.filter((tool) => {
      const category = classifyTool(tool);
      const categoryMatch = activeCategory === 'all' || category === activeCategory;
      const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
      return categoryMatch && (!normalizedSearch || haystack.includes(normalizedSearch));
    }),
    [tools, activeCategory, normalizedSearch],
  );

  const chooseTool = (tool: FlixoAgentStudioTool) => {
    setQuery(locale === 'ar'
      ? `استخدم أداة "${tool.title}" على الملف المرفق`
      : `Use "${tool.title}" on the attached file`);
  };

  return (
    <section className="flixo-ai-agent flixo-agent-studio" aria-labelledby="flixo-agent-studio-title" data-testid="flixo-agent-studio">
      <nav className="flixo-agent-rail" aria-label={locale === 'ar' ? 'تنقل وكيل فليكسو' : 'FLIXO agent navigation'}>
        <div className="flixo-agent-rail-logo mono">FX</div>
        <button className="flixo-agent-rail-btn active" type="button" title={locale === 'ar' ? 'المحادثة' : 'Chat'} aria-label={locale === 'ar' ? 'المحادثة' : 'Chat'}>
          <span>◌</span>
        </button>
        <button className="flixo-agent-rail-btn" type="button" title={locale === 'ar' ? 'السجل' : 'History'} aria-label={locale === 'ar' ? 'السجل' : 'History'}>
          <span>◷</span>
        </button>
        <button className="flixo-agent-rail-btn" type="button" title={locale === 'ar' ? 'المشاريع' : 'Projects'} aria-label={locale === 'ar' ? 'المشاريع' : 'Projects'}>
          <span>□</span>
        </button>
        <div className="flixo-agent-rail-spacer" />
        <Link className="flixo-agent-rail-btn" to="/admin" title={locale === 'ar' ? 'الإدارة' : 'Admin'} aria-label={locale === 'ar' ? 'الإدارة' : 'Admin'}>
          <span>⚙</span>
        </Link>
      </nav>

      <section className="flixo-agent-chat-col">
        <header className="flixo-agent-chat-top">
          <div className="flixo-agent-chat-top-left">
            <span className="flixo-agent-status-dot" />
            <div>
              <div className="flixo-agent-chat-title" id="flixo-agent-studio-title">وكيل FLIXO</div>
              <div className="flixo-agent-chat-sub">{locale === 'ar' ? 'جاهز لفهم طلبك وتنفيذ أدوات FLIXO' : 'Ready to understand and execute FLIXO tools'}</div>
            </div>
          </div>
          <div className="flixo-agent-chat-top-actions">
            <label className="flixo-language-switch" title={locale === 'ar' ? 'تغيير اللغة' : 'Change language'}>
              <span aria-hidden="true">🌐</span>
              <select
                value={locale}
                aria-label={locale === 'ar' ? 'تغيير اللغة' : 'Change language'}
                onChange={(event) => {
                  const next = event.target.value as Locale;
                  void navigate(next === 'en' ? { to: '/' } : { to: '/$locale', params: { locale: next } });
                }}
              >
                {LOCALES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>)}
              </select>
            </label>
            <span className="flixo-agent-state-badge mono">
              {state === 'running' ? (locale === 'ar' ? 'يعمل' : 'RUNNING')
                : state === 'success' ? (locale === 'ar' ? 'تم' : 'DONE')
                : state === 'ready' ? (locale === 'ar' ? 'بانتظار التأكيد' : 'READY')
                : state === 'error' ? (locale === 'ar' ? 'يحتاج مراجعة' : 'CHECK')
                : (locale === 'ar' ? 'جاهز' : 'READY')}
            </span>
          </div>
        </header>

        <div className="flixo-agent-messages" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`flixo-agent-msg ${message.role}`}>
              <div className={`flixo-agent-avatar ${message.role}`}>{message.role === 'agent' ? 'FX' : (locale === 'ar' ? 'أنت' : 'YOU')}</div>
              <div className="flixo-agent-bubble">
                <p>{message.text}</p>
                {message.role === 'user' && file && message.id === messages.filter((item) => item.role === 'user').at(-1)?.id && (
                  <div className="flixo-agent-attachment">
                    <span className="flixo-agent-thumb" aria-hidden="true" />
                    <span>{file.name} — {(file.size / (1024 * 1024)).toFixed(1)}MB</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {plan && state === 'ready' && (
            <div className="flixo-agent-inline-card" data-testid="flixo-agent-plan-ready">
              <div>
                <strong>{locale === 'ar' ? 'الخطة جاهزة للتنفيذ' : 'Plan ready for execution'}</strong>
                <span>{planned?.steps?.length ?? plan.steps.length} {locale === 'ar' ? 'خطوة' : 'steps'}</span>
              </div>
              <span>{file ? (locale === 'ar' ? 'اكتب «نفذ» للتشغيل' : 'Type “execute” to run') : copy.uploadThenExecute}</span>
            </div>
          )}

          {filterHandoff && (
            <div className="flixo-agent-inline-card">
              <div>
                <strong>Filter Mask</strong>
                <span>{locale === 'ar' ? 'جاهز للمعاينة المباشرة' : 'Ready for live preview'}</span>
              </div>
              <Link
                className="flixo-agent-inline-link"
                to="/$locale/$tool"
                params={{ locale, tool: 'filter-mask' }}
                search={{
                  canonicalId: filterHandoff.canonicalId,
                  intensity: filterHandoff.parameters.intensity,
                  zoom: filterHandoff.parameters.zoom,
                  mirror: filterHandoff.parameters.mirror,
                  aspectRatio: filterHandoff.parameters.aspectRatio,
                  captureQuality: filterHandoff.parameters.captureQuality,
                }}
              >
                {locale === 'ar' ? 'فتح المعاينة' : 'Open preview'}
              </Link>
            </div>
          )}

          {progress && (
            <div className="flixo-agent-inline-progress">
              <span>{locale === 'ar' ? 'التقدم' : 'Progress'} {progress.currentStepIndex}/{progress.totalSteps}</span>
              <strong>{progress.currentToolId}</strong>
              {progress.retry ? <small>{locale === 'ar' ? 'إعادة المحاولة' : 'Retry'} {progress.retry}</small> : null}
            </div>
          )}

          {error && <div className="flixo-agent-error" role="alert">{error}</div>}

          {state === 'success' && result && (
            <div className="flixo-agent-success-card">
              <div>
                <strong>{copy.success}</strong>
                <span>{locale === 'ar' ? 'الناتج تم التحقق منه داخل مسار التنفيذ الحالي.' : 'The result completed the current execution path.'}</span>
              </div>
              <button type="button" className="flixo-agent-primary" onClick={onDownload}>{copy.download}</button>
            </div>
          )}
        </div>

        <div className="flixo-agent-composer-wrap">
          <div className="flixo-agent-suggest-row" aria-label={copy.examplesLabel}>
            {copy.examples.map((example) => (
              <button key={example} type="button" className="flixo-agent-suggest-chip" onClick={() => setQuery(example)}>
                {example}
              </button>
            ))}
          </div>
          <div className="flixo-agent-composer">
            <label className="flixo-agent-icon-btn" title={copy.fileLabel} htmlFor="flixo-agent-file">+</label>
            <textarea
              id="flixo-agent-command"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
              placeholder={copy.placeholder}
              rows={1}
              autoComplete="off"
              aria-label={copy.commandLabel}
            />
            <button
              type="button"
              className="flixo-agent-icon-btn flixo-agent-send"
              onClick={() => void sendMessage()}
              disabled={!query.trim() || state === 'running'}
              title={copy.send}
            >
              ➤
            </button>
          </div>
          <input
            id="flixo-agent-file"
            className="flixo-agent-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <div className="flixo-agent-secondary-actions">
            <button type="button" className="flixo-agent-ghost" onClick={() => void prepare()} disabled={!query.trim() || state === 'running'}>
              {copy.analyze}
            </button>
            <span>{file ? file.name : (locale === 'ar' ? 'لم يتم إرفاق ملف' : 'No file attached')}</span>
          </div>
        </div>
      </section>

      <aside className="flixo-agent-tools-panel" aria-label={locale === 'ar' ? 'أدوات FLIXO' : 'FLIXO tools'}>
        <div className="flixo-agent-tools-head">
          <h2>{locale === 'ar' ? 'تصفح الأدوات' : 'Browse tools'}</h2>
          <div className="flixo-agent-tool-search">
            <span aria-hidden="true">⌕</span>
            <input value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} placeholder={locale === 'ar' ? 'ابحث عن أداة…' : 'Search tools…'} />
          </div>
          <div className="flixo-agent-tabs" role="tablist">
            {([
              ['all', locale === 'ar' ? 'الكل' : 'All'],
              ['image', locale === 'ar' ? 'صور' : 'Images'],
              ['video', locale === 'ar' ? 'فيديو' : 'Video'],
              ['filter', locale === 'ar' ? 'فلاتر' : 'Filters'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeCategory === key}
                className={`flixo-agent-tab ${activeCategory === key ? 'active' : ''}`}
                onClick={() => setActiveCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flixo-agent-tools-grid">
          {filteredTools.length ? filteredTools.map((tool) => (
            <button key={tool.id} type="button" className={`flixo-agent-tool-card ${classifyTool(tool) === 'filter' ? 'filter' : ''}`} onClick={() => chooseTool(tool)}>
              <span className="flixo-agent-tool-icon" aria-hidden="true">✦</span>
              <span className="flixo-agent-tool-body">
                <strong>{tool.title}</strong>
                <small>{tool.description}</small>
                <em className="mono">{tool.id}</em>
              </span>
            </button>
          )) : (
            <div className="flixo-agent-empty">{locale === 'ar' ? 'لا توجد أدوات مطابقة لبحثك.' : 'No matching tools.'}</div>
          )}
        </div>
      </aside>
    </section>
  );
}
