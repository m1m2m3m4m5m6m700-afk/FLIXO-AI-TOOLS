import { useEffect, useRef, type ReactNode } from 'react';
import { Activity, CheckCircle2, Download, RotateCcw, Upload, Command } from 'lucide-react';
import { getToolUiCopy } from '@/data/tool-ui-i18n';
import { SHARED_TOOL_UI_COPY, translateSharedToolText } from '@/lib/i18n/shared-tool-ui';
import type { Locale } from '@/lib/i18n';
import { ElegantAdSlot } from '@/components/ads/ElegantAdSlot';
import './technical-tool-shell-premium.css';

type TechnicalToolShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  ready?: boolean;
  progress?: number;
  onUpload?: () => void;
  onReset?: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  onCommandMenu?: () => void;
  children: ReactNode;
};

const EXTERNAL_PROCESSING: Record<Locale, string> = {
  ar: 'معالجة خارجية', en: 'External processing', es: 'Procesamiento externo', fr: 'Traitement externe', de: 'Externe Verarbeitung', ru: 'Внешняя обработка', hi: 'बाहरी प्रोसेसिंग', id: 'Pemrosesan eksternal', ja: '外部処理', pt: 'Processamento externo', it: 'Elaborazione esterna', ko: '외부 처리', nl: 'Externe verwerking', pl: 'Przetwarzanie zewnętrzne', tr: 'Harici işleme', vi: 'Xử lý bên ngoài', th: 'การประมวลผลภายนอก', sv: 'Extern bearbetning', ms: 'Pemprosesan luaran', uk: 'Зовнішня обробка',
};

function localeFromDocument(): Locale {
  const value = typeof document === 'undefined' ? 'en' : document.documentElement.lang.toLowerCase().split('-')[0];
  return value in SHARED_TOOL_UI_COPY ? value as Locale : 'en';
}

function translateShellValue(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const compact = value.trim();
  const externalMatch = compact.match(/^↗\s*External processing (.+?) uses a configured external processing endpoint and is not presented as local-only\.$/);
  if (externalMatch) return `↗ ${EXTERNAL_PROCESSING[locale]} ${externalMatch[1].trim()} ${SHARED_TOOL_UI_COPY[locale].externalSuffix}`;
  return translateSharedToolText(locale, value);
}

function localizeSharedShell(root: HTMLElement, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent) continue;
    if (parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const current = node.nodeValue ?? '';
    const next = translateShellValue(locale, current);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateShellValue(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function TechnicalToolShell({ title, eyebrow, description, ready = true, progress, onUpload, onReset, onExport, exportDisabled = false, onCommandMenu, children }: TechnicalToolShellProps) {
  const copy = getToolUiCopy();
  const shellRef = useRef<HTMLDivElement>(null);
  const locale = localeFromDocument();

  useEffect(() => {
    const root = shellRef.current;
    if (!root || locale === 'en') return;
    const apply = () => localizeSharedShell(root, locale);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div ref={shellRef} className="relative mx-auto w-full max-w-[1560px] p-0 sm:p-1 lg:p-2">
      <div className="flixo-premium-shell relative overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0a0c0f] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0a0c0f]/96 px-3 py-2.5 backdrop-blur-xl sm:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-white">{title}</div>
              {eyebrow ? <span className="hidden border-l border-white/[0.12] pl-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500 md:inline">{eyebrow}</span> : null}
            </div>
            {description ? <p className="mt-0.5 max-w-2xl truncate text-[11px] leading-5 text-zinc-500">{description}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <div className="flixo-tool-status" aria-label={ready ? copy.ready : copy.waiting}>
              <span className={`flixo-status-dot ${ready ? 'is-ready' : ''}`} />
              <Activity className="size-3" aria-hidden="true" />
              {ready ? copy.ready : copy.waiting}
            </div>
            {onCommandMenu ? <button type="button" onClick={onCommandMenu} className="flixo-tool-action" aria-label={copy.openCommandPalette}><Command className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.command}</span><kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-zinc-500 sm:inline">⌘K</kbd></button> : null}
            {onUpload ? <button type="button" onClick={onUpload} className="flixo-tool-action" aria-label={copy.upload}><Upload className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.upload}</span></button> : null}
            {onReset ? <button type="button" onClick={onReset} className="flixo-tool-action" aria-label={copy.reset}><RotateCcw className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">{copy.reset}</span></button> : null}
            {onExport ? <button type="button" onClick={onExport} disabled={exportDisabled} className="flixo-tool-primary" aria-label={copy.exportLabel}><Download className="size-3.5" aria-hidden="true" />{copy.exportLabel}</button> : null}
          </div>
        </header>
        {typeof progress === 'number' ? <div className="relative h-0.5 overflow-hidden bg-black/30"><div className="h-full bg-violet-400/75 transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div> : null}
        <div className="relative z-10 p-2.5 sm:p-3 lg:p-4">{children}</div>
      </div>
      <ElegantAdSlot />
      <div className="mt-2 flex items-center justify-end gap-1.5 px-1 text-[9px] text-zinc-600"><CheckCircle2 className="size-3" aria-hidden="true" />{copy.localWorkspace}</div>
    </div>
  );
}
