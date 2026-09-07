import { DEFAULT_LOCALE, isLocale, LOCALE_METADATA, type CanonicalLocale } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;
const LOCALE_RUNTIME_EVENT = 'flixo:document-locale-path-change';

type PatchedHistory = History & {
  __flixoLocalePatched?: boolean;
};

function canonicalLocale(value: string | null | undefined): CanonicalLocale {
  const candidate = value?.trim().toLowerCase() ?? '';
  return isLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

export function localeFromPathname(pathname: string): CanonicalLocale {
  const candidate = pathname?.match(LOCALE_PATH_RE)?.[1] ?? '';
  return canonicalLocale(candidate);
}

export function applyDocumentLocale(locale: CanonicalLocale): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;
  if (!html) return;

  const safeLocale = canonicalLocale(locale);
  const metadata = LOCALE_METADATA[safeLocale];
  if (!metadata) return;

  const languageTag = metadata.languageTag.trim();
  const direction = metadata.direction;
  if (!languageTag) return;

  if (html.getAttribute('lang') !== languageTag) html.setAttribute('lang', languageTag);
  if (html.getAttribute('dir') !== direction) html.setAttribute('dir', direction);
  if (html.getAttribute('data-flixo-locale') !== safeLocale) html.setAttribute('data-flixo-locale', safeLocale);

  const body = document.body;
  if (body && body.getAttribute('data-flixo-locale') !== safeLocale) {
    body.setAttribute('data-flixo-locale', safeLocale);
  }
}

export class ToolUiLocalizationEngine {
  private static active: ToolUiLocalizationEngine | null = null;

  private disposed = false;
  private started = false;
  private observedHtml: HTMLElement | null = null;
  private htmlObserver: MutationObserver | null = null;
  private documentObserver: MutationObserver | null = null;
  private scheduled = false;
  private restoreHistory = () => undefined;

  public constructor(private readonly getPathname: () => string = () => window.location.pathname) {}

  public start(): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
    if (this.started) return () => this.dispose();

    ToolUiLocalizationEngine.active?.dispose();
    ToolUiLocalizationEngine.active = this;
    this.started = true;
    this.disposed = false;

    this.apply();
    this.installHtmlObserver();
    this.installPathLifecycle();

    this.documentObserver = new MutationObserver(() => {
      if (document.documentElement !== this.observedHtml) {
        this.installHtmlObserver();
        this.scheduleApply();
      }
    });
    this.documentObserver.observe(document, { childList: true });

    return () => this.dispose();
  }

  private readPathname(): string {
    try {
      const pathname = this.getPathname();
      return typeof pathname === 'string' ? pathname : '/';
    } catch {
      return '/';
    }
  }

  private installHtmlObserver(): void {
    const html = document.documentElement;
    if (!html) {
      this.htmlObserver?.disconnect();
      this.htmlObserver = null;
      this.observedHtml = null;
      return;
    }

    if (this.observedHtml === html && this.htmlObserver) return;

    this.htmlObserver?.disconnect();
    this.observedHtml = html;
    this.htmlObserver = new MutationObserver(() => this.scheduleApply());
    this.htmlObserver.observe(html, {
      attributes: true,
      attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
    });
  }

  private apply(): void {
    if (this.disposed) return;
    this.installHtmlObserver();
    if (!document.documentElement) return;
    applyDocumentLocale(localeFromPathname(this.readPathname()));
  }

  private scheduleApply(): void {
    if (this.disposed || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.apply();
    });
  }

  private installPathLifecycle(): void {
    const onPathChange = () => this.scheduleApply();
    window.addEventListener('popstate', onPathChange);
    window.addEventListener('hashchange', onPathChange);
    window.addEventListener(LOCALE_RUNTIME_EVENT, onPathChange);
    document.addEventListener('DOMContentLoaded', onPathChange, { once: true });
    window.addEventListener('load', onPathChange, { once: true });

    const history = window.history as PatchedHistory;
    if (!history.__flixoLocalePatched) {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function pushState(...args) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new Event(LOCALE_RUNTIME_EVENT));
        return result;
      };
      history.replaceState = function replaceState(...args) {
        const result = originalReplaceState.apply(this, args);
        window.dispatchEvent(new Event(LOCALE_RUNTIME_EVENT));
        return result;
      };

      history.__flixoLocalePatched = true;
      this.restoreHistory = () => {
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        delete history.__flixoLocalePatched;
      };
    }

    this.pathCleanup = () => {
      window.removeEventListener('popstate', onPathChange);
      window.removeEventListener('hashchange', onPathChange);
      window.removeEventListener(LOCALE_RUNTIME_EVENT, onPathChange);
      document.removeEventListener('DOMContentLoaded', onPathChange);
      window.removeEventListener('load', onPathChange);
      this.restoreHistory();
      this.restoreHistory = () => undefined;
    };
  }

  private pathCleanup = () => undefined;

  public dispose(): void {
    if (!this.started || this.disposed) return;
    this.disposed = true;
    this.pathCleanup();
    this.htmlObserver?.disconnect();
    this.documentObserver?.disconnect();
    this.htmlObserver = null;
    this.documentObserver = null;
    this.observedHtml = null;
    if (ToolUiLocalizationEngine.active === this) ToolUiLocalizationEngine.active = null;
  }
}

export function installDocumentLocaleContract(getPathname: () => string): () => void {
  return new ToolUiLocalizationEngine(getPathname).start();
}
