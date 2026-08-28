import type { Locale } from '@/lib/i18n';

export type AdSurface = 'content' | 'tool' | 'error' | 'empty' | 'modal' | 'loader' | 'internal';

const BLOCKED_AD_SURFACES: readonly AdSurface[] = ['error', 'empty', 'modal', 'loader', 'internal'];

export const ADSENSE_INTERNAL_POLICY = Object.freeze({
  minInteractiveGapPx: 25,
  reservedMinHeightPx: 100,
  blockedSurfaces: BLOCKED_AD_SURFACES,
  mobile: {
    minStickyViewportHeightPx: 667,
    disableStickyMediaQuery: '(max-height: 666px)',
  },
  contentQuality: {
    note: 'Internal FLIXO hardening; Google does not publish a universal word-count quota.',
    minWords: 140,
    duplicateSimilarityBlockThreshold: 0.92,
  },
  cwvTargets: {
    lcpMs: 2500,
    inpMs: 200,
    cls: 0.1,
  },
  consent: {
    framework: 'IAB TCF',
    version: '2.3',
  },
} as const);

const AD_LABELS: Record<Locale, string> = {
  en: 'Advertisements',
  ar: 'إعلانات',
  es: 'Anuncios',
  fr: 'Publicités',
  de: 'Werbung',
  ru: 'Реклама',
  zh: '广告',
  hi: 'विज्ञापन',
  id: 'Iklan',
  ur: 'اشتہارات',
  ja: '広告',
  pt: 'Publicidade',
  it: 'Pubblicità',
  ko: '광고',
  nl: 'Advertenties',
  pl: 'Reklamy',
  tr: 'Reklamlar',
  vi: 'Quảng cáo',
  th: 'โฆษณา',
  sv: 'Annonser',
};

export function getAdLabel(locale: Locale): string {
  return AD_LABELS[locale];
}

export function isAdSurfaceAllowed(surface: AdSurface): boolean {
  return !BLOCKED_AD_SURFACES.includes(surface);
}

export function isAdsenseConfigured(): boolean {
  return Boolean(import.meta.env?.VITE_ADSENSE_PUBLISHER_ID?.trim());
}

export function isCertifiedCmpConfigured(): boolean {
  return Boolean(
    import.meta.env?.VITE_TCF_CMP_ID?.trim() &&
    import.meta.env?.VITE_TCF_CMP_CERTIFIED?.trim().toLowerCase() === 'true',
  );
}

type TcfData = {
  eventStatus?: string;
  gdprApplies?: boolean;
  listenerId?: number;
  purpose?: { consents?: Record<string, boolean> };
  vendor?: { consents?: Record<string, boolean> };
};

type TcfCallback = (tcData: TcfData, success?: boolean) => void;
type TcfApi = {
  (command: 'addEventListener', version: 2, callback: TcfCallback): void;
  (command: 'removeEventListener', version: 2, callback: (success: boolean) => void, listenerId: number): void;
};

type TcfWindow = Window & { __tcfapi?: TcfApi };

function getTcfApi(): TcfApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as TcfWindow).__tcfapi;
}

function consentFromData(tcData: TcfData): boolean {
  if (tcData.gdprApplies === false) return true;
  if (tcData.eventStatus !== 'tcloaded' && tcData.eventStatus !== 'useractioncomplete') return false;
  return Boolean(tcData.purpose?.consents?.['1'] && tcData.vendor?.consents?.['755']);
}

export function subscribeToTcfConsent(listener: (consent: boolean) => void): () => void {
  if (!isCertifiedCmpConfigured()) return () => undefined;
  const tcfApi = getTcfApi();
  if (!tcfApi) return () => undefined;

  let active = true;
  let listenerId: number | undefined;
  let cleanupRequested = false;
  const cleanup = () => {
    if (!cleanupRequested || typeof listenerId !== 'number') return;
    active = false;
    try {
      tcfApi('removeEventListener', 2, () => undefined, listenerId);
    } catch {
      active = false;
    }
  };
  const callback: TcfCallback = (tcData, success = true) => {
    if (!active || !success) return;
    if (typeof tcData.listenerId === 'number') listenerId = tcData.listenerId;
    listener(consentFromData(tcData));
  };

  try {
    tcfApi('addEventListener', 2, callback);
  } catch {
    return () => undefined;
  }

  return () => {
    cleanupRequested = true;
    cleanup();
  };
}

export function hasTcfConsent(): Promise<boolean> {
  if (!isCertifiedCmpConfigured()) return Promise.resolve(false);
  const tcfApi = getTcfApi();
  if (!tcfApi) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    let listenerId: number | undefined;
    let timer: number | undefined;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (typeof listenerId === 'number') {
        try {
          tcfApi('removeEventListener', 2, () => undefined, listenerId);
        } catch {
          // Fail closed; the promise is already settled.
        }
      }
      resolve(value);
    };
    const callback: TcfCallback = (tcData, success = true) => {
      if (!success) {
        finish(false);
        return;
      }
      if (typeof tcData.listenerId === 'number') listenerId = tcData.listenerId;
      finish(consentFromData(tcData));
    };

    try {
      tcfApi('addEventListener', 2, callback);
      if (!settled) timer = window.setTimeout(() => finish(false), 1500);
    } catch {
      finish(false);
    }
  });
}
