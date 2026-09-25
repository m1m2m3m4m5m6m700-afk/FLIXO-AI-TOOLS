import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import type { ExecutionPlan } from '@/lib/ai/planner';
import type { PipelineProgress } from '@/lib/workflows/pipeline-runner';
import { LOCALES, type Locale } from '@/lib/i18n';
import type { FilterMaskHandoff } from '@/tools/filter-mask/handoff';
import type { AGENT_I18N } from '@/data/agent-locales';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeToolCategory, localizeToolDescription } from '@/lib/i18n/tool-localization';

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

type AgentUiCopy = Readonly<{
  agentName: string;
  navigation: string;
  chat: string;
  history: string;
  projects: string;
  admin: string;
  changeLanguage: string;
  tools: string;
  browseTools: string;
  searchTools: string;
  all: string;
  images: string;
  video: string;
  filters: string;
  you: string;
  openPreview: string;
}>;

const AGENT_UI_COPY: Readonly<Record<Locale, AgentUiCopy>> = {
  en: { agentName: 'FLIXO Agent', navigation: 'FLIXO agent navigation', chat: 'Chat', history: 'History', projects: 'Projects', admin: 'Admin', changeLanguage: 'Change language', tools: 'FLIXO tools', browseTools: 'Browse tools', searchTools: 'Search tools…', all: 'All', images: 'Images', video: 'Video', filters: 'Filters', you: 'YOU', openPreview: 'Open preview' },
  ar: { agentName: 'وكيل FLIXO', navigation: 'تنقل وكيل فليكسو', chat: 'المحادثة', history: 'السجل', projects: 'المشاريع', admin: 'الإدارة', changeLanguage: 'تغيير اللغة', tools: 'أدوات FLIXO', browseTools: 'تصفح الأدوات', searchTools: 'ابحث عن أداة…', all: 'الكل', images: 'الصور', video: 'الفيديو', filters: 'الفلاتر', you: 'أنت', openPreview: 'فتح المعاينة' },
  es: { agentName: 'Agente FLIXO', navigation: 'Navegación del agente FLIXO', chat: 'Conversación', history: 'Historial', projects: 'Proyectos', admin: 'Administración', changeLanguage: 'Cambiar idioma', tools: 'Herramientas de FLIXO', browseTools: 'Explorar herramientas', searchTools: 'Buscar herramientas…', all: 'Todo', images: 'Imágenes', video: 'Vídeo', filters: 'Filtros', you: 'Tú', openPreview: 'Abrir vista previa' },
  fr: { agentName: 'Agent FLIXO', navigation: 'Navigation de l’agent FLIXO', chat: 'Discussion', history: 'Historique', projects: 'Projets', admin: 'Administration', changeLanguage: 'Changer de langue', tools: 'Outils FLIXO', browseTools: 'Parcourir les outils', searchTools: 'Rechercher des outils…', all: 'Tous', images: 'Visuels', video: 'Vidéo', filters: 'Filtres', you: 'Vous', openPreview: 'Ouvrir l’aperçu' },
  de: { agentName: 'FLIXO-Agent', navigation: 'FLIXO-Agent-Navigation', chat: 'Unterhaltung', history: 'Verlauf', projects: 'Projekte', admin: 'Administration', changeLanguage: 'Sprache ändern', tools: 'FLIXO-Tools', browseTools: 'Tools durchsuchen', searchTools: 'Tools suchen…', all: 'Alle', images: 'Bilder', video: 'Videos', filters: 'Filter', you: 'DU', openPreview: 'Vorschau öffnen' },
  hi: { agentName: 'FLIXO एजेंट', navigation: 'FLIXO एजेंट नेविगेशन', chat: 'चैट', history: 'इतिहास', projects: 'प्रोजेक्ट', admin: 'प्रशासन', changeLanguage: 'भाषा बदलें', tools: 'FLIXO टूल', browseTools: 'टूल ब्राउज़ करें', searchTools: 'टूल खोजें…', all: 'सभी', images: 'छवियाँ', video: 'वीडियो', filters: 'फ़िल्टर', you: 'आप', openPreview: 'पूर्वावलोकन खोलें' },
  id: { agentName: 'Agen FLIXO', navigation: 'Navigasi agen FLIXO', chat: 'Obrolan', history: 'Riwayat', projects: 'Proyek', admin: 'Administrasi', changeLanguage: 'Ganti bahasa', tools: 'Alat FLIXO', browseTools: 'Jelajahi alat', searchTools: 'Cari alat…', all: 'Semua', images: 'Gambar', video: 'Konten video', filters: 'Filter', you: 'ANDA', openPreview: 'Buka pratinjau' },
  it: { agentName: 'Agente FLIXO', navigation: 'Navigazione agente FLIXO', chat: 'Conversazione', history: 'Cronologia', projects: 'Progetti', admin: 'Amministrazione', changeLanguage: 'Cambia lingua', tools: 'Strumenti FLIXO', browseTools: 'Sfoglia strumenti', searchTools: 'Cerca strumenti…', all: 'Tutti', images: 'Immagini', video: 'Filmati', filters: 'Filtri', you: 'TU', openPreview: 'Apri anteprima' },
  ja: { agentName: 'FLIXOエージェント', navigation: 'FLIXOエージェントナビゲーション', chat: 'チャット', history: '履歴', projects: 'プロジェクト', admin: '管理', changeLanguage: '言語を変更', tools: 'FLIXOツール', browseTools: 'ツールを参照', searchTools: 'ツールを検索…', all: 'すべて', images: '画像', video: '動画', filters: 'フィルター', you: 'あなた', openPreview: 'プレビューを開く' },
  ko: { agentName: 'FLIXO 에이전트', navigation: 'FLIXO 에이전트 탐색', chat: '채팅', history: '기록', projects: '프로젝트', admin: '관리', changeLanguage: '언어 변경', tools: 'FLIXO 도구', browseTools: '도구 찾아보기', searchTools: '도구 검색…', all: '전체', images: '이미지', video: '비디오', filters: '필터', you: '당신', openPreview: '미리보기 열기' },
  ms: { agentName: 'Ejen FLIXO', navigation: 'Navigasi ejen FLIXO', chat: 'Sembang', history: 'Sejarah', projects: 'Projek', admin: 'Pentadbir', changeLanguage: 'Tukar bahasa', tools: 'Alat FLIXO', browseTools: 'Semak alat', searchTools: 'Cari alat…', all: 'Semua', images: 'Imej', video: 'Kandungan video', filters: 'Penapis', you: 'ANDA', openPreview: 'Buka pratonton' },
  nl: { agentName: 'FLIXO-agent', navigation: 'FLIXO-agentnavigatie', chat: 'Gesprek', history: 'Geschiedenis', projects: 'Projecten', admin: 'Beheer', changeLanguage: 'Taal wijzigen', tools: 'FLIXO-tools', browseTools: 'Tools bekijken', searchTools: 'Tools zoeken…', all: 'Alle', images: 'Afbeeldingen', video: 'Video’s', filters: 'Filteropties', you: 'JIJ', openPreview: 'Voorbeeld openen' },
  pl: { agentName: 'Agent FLIXO', navigation: 'Nawigacja agenta FLIXO', chat: 'Czat', history: 'Historia', projects: 'Projekty', admin: 'Administracja', changeLanguage: 'Zmień język', tools: 'Narzędzia FLIXO', browseTools: 'Przeglądaj narzędzia', searchTools: 'Szukaj narzędzi…', all: 'Wszystkie', images: 'Obrazy', video: 'Wideo', filters: 'Filtry', you: 'TY', openPreview: 'Otwórz podgląd' },
  pt: { agentName: 'Agente FLIXO', navigation: 'Navegação do agente FLIXO', chat: 'Conversa', history: 'Histórico', projects: 'Projetos', admin: 'Administração', changeLanguage: 'Alterar idioma', tools: 'Ferramentas FLIXO', browseTools: 'Explorar ferramentas', searchTools: 'Pesquisar ferramentas…', all: 'Todos', images: 'Imagens', video: 'Vídeo', filters: 'Filtros', you: 'VOCÊ', openPreview: 'Abrir pré-visualização' },
  ru: { agentName: 'Агент FLIXO', navigation: 'Навигация агента FLIXO', chat: 'Чат', history: 'История', projects: 'Проекты', admin: 'Администрирование', changeLanguage: 'Сменить язык', tools: 'Инструменты FLIXO', browseTools: 'Обзор инструментов', searchTools: 'Поиск инструментов…', all: 'Все', images: 'Изображения', video: 'Видео', filters: 'Фильтры', you: 'ВЫ', openPreview: 'Открыть предпросмотр' },
  sv: { agentName: 'FLIXO-agent', navigation: 'FLIXO-agentnavigering', chat: 'Chatt', history: 'Historik', projects: 'Projekt', admin: 'Administration', changeLanguage: 'Byt språk', tools: 'FLIXO-verktyg', browseTools: 'Bläddra bland verktyg', searchTools: 'Sök verktyg…', all: 'Alla', images: 'Bilder', video: 'Videor', filters: 'Filter', you: 'DU', openPreview: 'Öppna förhandsvisning' },
  th: { agentName: 'เอเจนต์ FLIXO', navigation: 'การนำทางเอเจนต์ FLIXO', chat: 'แชต', history: 'ประวัติ', projects: 'โปรเจกต์', admin: 'ผู้ดูแลระบบ', changeLanguage: 'เปลี่ยนภาษา', tools: 'เครื่องมือ FLIXO', browseTools: 'เรียกดูเครื่องมือ', searchTools: 'ค้นหาเครื่องมือ…', all: 'ทั้งหมด', images: 'รูปภาพ', video: 'วิดีโอ', filters: 'ฟิลเตอร์', you: 'คุณ', openPreview: 'เปิดตัวอย่าง' },
  tr: { agentName: 'FLIXO ajanı', navigation: 'FLIXO ajan gezinmesi', chat: 'Sohbet', history: 'Geçmiş', projects: 'Projeler', admin: 'Yönetim', changeLanguage: 'Dili değiştir', tools: 'FLIXO araçları', browseTools: 'Araçlara göz at', searchTools: 'Araçlarda ara…', all: 'Tümü', images: 'Görseller', video: 'Videolar', filters: 'Filtreler', you: 'SİZ', openPreview: 'Önizlemeyi aç' },
  uk: { agentName: 'Агент FLIXO', navigation: 'Навігація агента FLIXO', chat: 'Чат', history: 'Історія', projects: 'Проєкти', admin: 'Адміністрування', changeLanguage: 'Змінити мову', tools: 'Інструменти FLIXO', browseTools: 'Переглянути інструменти', searchTools: 'Пошук інструментів…', all: 'Усі', images: 'Зображення', video: 'Відео', filters: 'Фільтри', you: 'ВИ', openPreview: 'Відкрити попередній перегляд' },
  vi: { agentName: 'Tác nhân FLIXO', navigation: 'Điều hướng tác vụ FLIXO', chat: 'Trò chuyện', history: 'Lịch sử', projects: 'Dự án', admin: 'Quản trị', changeLanguage: 'Đổi ngôn ngữ', tools: 'Công cụ FLIXO', browseTools: 'Duyệt công cụ', searchTools: 'Tìm kiếm công cụ…', all: 'Tất cả', images: 'Hình ảnh', video: 'Nội dung video', filters: 'Bộ lọc', you: 'BẠN', openPreview: 'Mở bản xem trước' },
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
  const ui = AGENT_UI_COPY[locale];

  const localizedTools = useMemo(
    () => tools.map((tool) => {
      if (locale === 'en') return tool;
      const category = tool.category === 'Images' || tool.category === 'Video' || tool.category === 'Audio' || tool.category === 'AI' || tool.category === 'Editor'
        ? tool.category
        : 'Images';
      return {
        ...tool,
        title: getAuthoritativeToolSeoName({ id: tool.id, title: tool.title }, locale) ?? tool.title,
        description: localizeToolDescription(locale, getAuthoritativeToolSeoName({ id: tool.id, title: tool.title }, locale) ?? tool.title, category),
        category: localizeToolCategory(locale, category),
      };
    }),
    [locale, tools],
  );

  const filteredTools = useMemo(
    () => localizedTools.filter((tool) => {
      const category = classifyTool(tool);
      const categoryMatch = activeCategory === 'all' || category === activeCategory;
      const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
      return categoryMatch && (!normalizedSearch || haystack.includes(normalizedSearch));
    }),
    [localizedTools, activeCategory, normalizedSearch],
  );

  const chooseTool = (tool: FlixoAgentStudioTool) => {
    setQuery(locale === 'ar'
      ? `استخدم أداة "${tool.title}" على الملف المرفق`
      : `Use "${tool.title}" on the attached file`);
  };

  return (
    <section className="flixo-ai-agent flixo-agent-studio" aria-labelledby="flixo-agent-studio-title" data-testid="flixo-agent-studio">
      <nav className="flixo-agent-rail" aria-label={ui.navigation}>
        <img className="flixo-agent-rail-logo" src="/flixo-brand-mark.webp" alt="FLIXO" width={34} height={34} />
        <button className="flixo-agent-rail-btn active" type="button" title={ui.chat} aria-label={ui.chat}>
          <span>◌</span>
        </button>
        <button className="flixo-agent-rail-btn" type="button" title={ui.history} aria-label={ui.history}>
          <span>◷</span>
        </button>
        <button className="flixo-agent-rail-btn" type="button" title={ui.projects} aria-label={ui.projects}>
          <span>□</span>
        </button>
        <div className="flixo-agent-rail-spacer" />
        <Link className="flixo-agent-rail-btn" to="/admin" title={ui.admin} aria-label={ui.admin}>
          <span>⚙</span>
        </Link>
      </nav>

      <section className="flixo-agent-chat-col">
        <header className="flixo-agent-chat-top">
          <div className="flixo-agent-chat-top-left">
            <img className="flixo-agent-chat-logo" src="/flixo-brand-mark.webp" alt="" width={28} height={28} />
            <span className="flixo-agent-status-dot" />
            <div>
              <div className="flixo-agent-chat-title" id="flixo-agent-studio-title">{ui.agentName}</div>
              <div className="flixo-agent-chat-sub">{copy.title}</div>
            </div>
          </div>
          <div className="flixo-agent-chat-top-actions">
            <label className="flixo-language-switch" title={ui.changeLanguage}>
              <span aria-hidden="true">🌐</span>
              <select
                value={locale}
                aria-label={ui.changeLanguage}
                onChange={(event) => {
                  const next = event.target.value as Locale;
                  void navigate(next === 'en' ? { to: '/' } : { to: '/$locale', params: { locale: next } });
                }}
              >
                {LOCALES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>)}
              </select>
            </label>
            <span className="flixo-agent-state-badge mono">
              {state === 'running' ? copy.executing
                : state === 'success' ? copy.completed
                : state === 'ready' ? copy.planReady
                : state === 'error' ? copy.needsAttention
                : copy.badge}
            </span>
          </div>
        </header>

        <div className="flixo-agent-messages" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`flixo-agent-msg ${message.role}`}>
              <div className={`flixo-agent-avatar ${message.role}`}>{message.role === 'agent' ? <img src="/flixo-brand-mark.webp" alt="FLIXO" width={28} height={28} /> : ui.you}</div>
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
                <strong>{copy.planReady}</strong>
                {(() => {
                  const stepCount = planned?.steps?.length ?? plan.steps.length;
                  const stepLabel = locale === 'en' && stepCount !== 1 ? 'steps' : copy.step;
                  return <span>{stepCount} {stepLabel}</span>;
                })()}
              </div>
              <span>{file ? copy.execute : copy.uploadThenExecute}</span>
            </div>
          )}

          {filterHandoff && (
            <div className="flixo-agent-inline-card">
              <div>
                <strong>{copy.nearestTool} Filter Mask</strong>
                <span>{copy.planReady}</span>
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
                {ui.openPreview}
              </Link>
            </div>
          )}

          {progress && (
            <div className="flixo-agent-inline-progress">
              <span>{copy.step} {progress.currentStepIndex}/{progress.totalSteps}</span>
              <strong>{progress.currentToolId}</strong>
              {progress.retry ? <small>{copy.retry} {progress.retry}</small> : null}
            </div>
          )}

          {error && <div className="flixo-agent-error" role="alert">{error}</div>}

          {state === 'success' && result && (
            <div className="flixo-agent-success-card">
              <div>
                <strong>{copy.success}</strong>
                <span>{copy.success}</span>
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
            <span>{file ? file.name : copy.needImage}</span>
          </div>
        </div>
      </section>

      <aside className="flixo-agent-tools-panel" aria-label={ui.tools}>
        <div className="flixo-agent-tools-head">
          <h2>{ui.browseTools}</h2>
          <div className="flixo-agent-tool-search">
            <span aria-hidden="true">⌕</span>
            <input value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} placeholder={ui.searchTools} />
          </div>
          <div className="flixo-agent-tabs" role="tablist">
            {([
              ['all', ui.all],
              ['image', ui.images],
              ['video', ui.video],
              ['filter', ui.filters],
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
            <div className="flixo-agent-empty">{copy.empty}</div>
          )}
        </div>
      </aside>
    </section>
  );
}
