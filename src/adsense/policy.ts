import type { Locale } from '@/lib/i18n';

export type AdSurface = 'content' | 'tool' | 'error' | 'empty' | 'modal' | 'loader' | 'internal';

const BLOCKED_AD_SURFACES: readonly AdSurface[] = ['error', 'empty', 'modal', 'loader', 'internal'];

export const ADSENSE_INTERNAL_POLICY = Object.freeze({
  minInteractiveGapPx: 25,
  reservedMinHeightPx: 100,
  blockedSurfaces: BLOCKED_AD_SURFACES,
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

type TcfApi = (
  command: 'addEventListener',
  version: 2,
  callback: (tcData: {
    eventStatus?: string;
    gdprApplies?: boolean;
    purpose?: { consents?: Record<string, boolean> };
    vendor?: { consents?: Record<string, boolean> };
  }) => void,
) => void;

export function hasTcfConsent(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const tcfApi = (window as Window & { __tcfapi?: TcfApi }).__tcfapi;
  if (!tcfApi) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      tcfApi('addEventListener', 2, (tcData) => {
        if (tcData.gdprApplies === false) {
          finish(true);
          return;
        }
        if (tcData.eventStatus !== 'tcloaded' && tcData.eventStatus !== 'useractioncomplete') return;
        finish(Boolean(tcData.purpose?.consents?.['1'] && tcData.vendor?.consents?.['755']));
      });
    } catch {
      finish(false);
    }

    window.setTimeout(() => finish(false), 1500);
  });
}
