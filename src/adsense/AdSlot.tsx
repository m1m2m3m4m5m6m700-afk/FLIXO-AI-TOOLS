import { useEffect, useId, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import {
  ADSENSE_INTERNAL_POLICY,
  getAdLabel,
  hasTcfConsent,
  subscribeToTcfConsent,
  isAdSurfaceAllowed,
  isAdsenseConfigured,
  isCertifiedCmpConfigured,
  type AdSurface,
} from './policy';

type AdsenseWindow = Window & {
  adsbygoogle?: Array<Record<string, unknown>>;
};

const ADSENSE_SCRIPT_ID = 'flixo-adsense-script';
let scriptPromise: Promise<void> | null = null;

function loadAdsenseScript(clientId: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const existing = document.getElementById(ADSENSE_SCRIPT_ID);
  if (existing) return scriptPromise ?? Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const promise: Promise<void> = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('AdSense script failed to load')), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  scriptPromise = promise;
  return promise;
}

function canRenderStickyAd(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerHeight < ADSENSE_INTERNAL_POLICY.mobile.minStickyViewportHeightPx) return false;
  return !window.matchMedia(ADSENSE_INTERNAL_POLICY.mobile.disableStickyMediaQuery).matches;
}

export type AdSlotProps = Readonly<{
  locale: Locale;
  slot: string;
  surface?: AdSurface;
  className?: string;
  sticky?: boolean;
  requiresFullCanvas?: boolean;
}>;

export function AdSlot({
  locale,
  slot,
  surface = 'content',
  className,
  sticky = false,
  requiresFullCanvas = false,
}: AdSlotProps) {
  const id = useId();
  const [eligible, setEligible] = useState(false);
  const [stickyViewportEligible, setStickyViewportEligible] = useState(() => canRenderStickyAd());

  useEffect(() => {
    if (!sticky || requiresFullCanvas) return () => undefined;

    const updateStickyEligibility = () => setStickyViewportEligible(canRenderStickyAd());
    const mediaQuery = window.matchMedia(ADSENSE_INTERNAL_POLICY.mobile.disableStickyMediaQuery);
    const visualViewport = window.visualViewport;
    updateStickyEligibility();
    window.addEventListener('resize', updateStickyEligibility, { passive: true });
    window.addEventListener('orientationchange', updateStickyEligibility, { passive: true });
    visualViewport?.addEventListener('resize', updateStickyEligibility, { passive: true });

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateStickyEligibility);
    } else {
      mediaQuery.addListener(updateStickyEligibility);
    }

    return () => {
      window.removeEventListener('resize', updateStickyEligibility);
      window.removeEventListener('orientationchange', updateStickyEligibility);
      visualViewport?.removeEventListener('resize', updateStickyEligibility);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updateStickyEligibility);
      } else {
        mediaQuery.removeListener(updateStickyEligibility);
      }
    };
  }, [requiresFullCanvas, sticky]);

  useEffect(() => {
    let active = true;
    if (!isAdsenseConfigured() || !isCertifiedCmpConfigured() || !isAdSurfaceAllowed(surface)) return () => undefined;

    const clientId = import.meta.env?.VITE_ADSENSE_PUBLISHER_ID?.trim();
    if (!clientId || !slot.trim()) return () => undefined;

    let unsubscribeConsent: () => void = () => undefined;
    void hasTcfConsent().then((consent) => {
      if (active) setEligible(consent);
    });
    unsubscribeConsent = subscribeToTcfConsent((consent) => {
      if (!active) return;
      setEligible(consent);
      if (!consent) {
        const host = document.getElementById(id);
        host?.querySelector('[data-flixo-adsense-slot]')?.replaceChildren();
        host?.removeAttribute('data-flixo-ad-initialized');
      }
    });

    return () => {
      active = false;
      unsubscribeConsent();
      const host = document.getElementById(id);
      host?.querySelector<HTMLElement>('[data-flixo-adsense-slot]')?.replaceChildren();
      host?.removeAttribute('data-flixo-ad-initialized');
    };
  }, [id, slot, surface]);

  useEffect(() => {
    if (!eligible) return () => undefined;
    const clientId = import.meta.env?.VITE_ADSENSE_PUBLISHER_ID?.trim();
    if (!clientId || !isCertifiedCmpConfigured()) return () => undefined;

    const host = document.getElementById(id);
    const ad = host?.querySelector<HTMLElement>('[data-flixo-adsense-slot]');
    if (!host || !ad || !ad.isConnected || ad.dataset.flixoAdInitialized === 'true') return () => undefined;

    let active = true;
    void loadAdsenseScript(clientId)
      .then(() => {
        if (!active || !ad.isConnected || !host.isConnected) return;
        if (ad.dataset.flixoAdInitialized === 'true') return;
        const win = window as AdsenseWindow;
        win.adsbygoogle = win.adsbygoogle ?? [];
        win.adsbygoogle.push({});
        ad.dataset.flixoAdInitialized = 'true';
        host.dataset.flixoAdInitialized = 'true';
      })
      .catch(() => {
        if (active && host.isConnected) host.setAttribute('data-flixo-ad-error', 'true');
      });

    return () => {
      active = false;
      ad.replaceChildren();
      delete ad.dataset.flixoAdInitialized;
      host.removeAttribute('data-flixo-ad-initialized');
    };
  }, [eligible, id]);

  if (!eligible) return null;

  const label = getAdLabel(locale);
  const stickyClass = sticky && !requiresFullCanvas && stickyViewportEligible ? 'flixo-ad-sticky' : '';
  const stickyEnabled = sticky && !requiresFullCanvas && stickyViewportEligible;

  return (
    <section
      id={id}
      className={[className, stickyClass].filter(Boolean).join(' ')}
      data-flixo-ad-container
      aria-label={label}
      style={{
        marginBlock: ADSENSE_INTERNAL_POLICY.minInteractiveGapPx,
        minHeight: ADSENSE_INTERNAL_POLICY.reservedMinHeightPx,
        overflow: 'hidden',
        contain: 'layout paint',
        zIndex: stickyEnabled ? 10 : undefined,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          marginBottom: 8,
          fontSize: 11,
          lineHeight: 1.2,
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {label}
      </div>
      <ins
        data-flixo-adsense-slot
        className="adsbygoogle"
        style={{ display: 'block', minHeight: ADSENSE_INTERNAL_POLICY.reservedMinHeightPx }}
        data-ad-client={clientIdValue()}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  );
}

function clientIdValue(): string {
  return import.meta.env?.VITE_ADSENSE_PUBLISHER_ID?.trim() ?? '';
}
