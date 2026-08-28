import { useEffect, useId, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import {
  ADSENSE_INTERNAL_POLICY,
  getAdLabel,
  hasTcfConsent,
  isAdSurfaceAllowed,
  isAdsenseConfigured,
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

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('AdSense script failed to load')), { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export type AdSlotProps = Readonly<{
  locale: Locale;
  slot: string;
  surface?: AdSurface;
  className?: string;
}>;

export function AdSlot({ locale, slot, surface = 'content', className }: AdSlotProps) {
  const id = useId();
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isAdsenseConfigured() || !isAdSurfaceAllowed(surface)) return;

    const clientId = import.meta.env?.VITE_ADSENSE_PUBLISHER_ID?.trim();
    if (!clientId || !slot.trim()) return;

    hasTcfConsent().then((consent) => {
      if (active && consent) setEligible(true);
    });

    return () => {
      active = false;
    };
  }, [slot, surface]);

  useEffect(() => {
    if (!eligible) return;
    const clientId = import.meta.env?.VITE_ADSENSE_PUBLISHER_ID?.trim();
    if (!clientId) return;

    const host = document.getElementById(id);
    const ad = host?.querySelector<HTMLElement>('[data-flixo-adsense-slot]');
    if (!ad || ad.dataset.flixoAdInitialized === 'true') return;

    let active = true;
    loadAdsenseScript(clientId)
      .then(() => {
        if (!active || ad.dataset.flixoAdInitialized === 'true') return;
        const win = window as AdsenseWindow;
        win.adsbygoogle = win.adsbygoogle ?? [];
        win.adsbygoogle.push({});
        ad.dataset.flixoAdInitialized = 'true';
      })
      .catch(() => {
        if (active) host?.setAttribute('data-flixo-ad-error', 'true');
      });

    return () => {
      active = false;
    };
  }, [eligible, id]);

  if (!eligible) return null;

  const label = getAdLabel(locale);

  return (
    <section
      id={id}
      className={className}
      data-flixo-ad-container
      aria-label={label}
      style={{
        marginBlock: ADSENSE_INTERNAL_POLICY.minInteractiveGapPx,
        minHeight: ADSENSE_INTERNAL_POLICY.reservedMinHeightPx,
        overflow: 'hidden',
        contain: 'layout paint',
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
