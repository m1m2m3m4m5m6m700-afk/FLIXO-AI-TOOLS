export type TelemetryEvent = 'ad_impression' | 'ad_clicked' | (string & {});
type TelemetryProperties = Record<string, string | number | boolean | null | undefined>;
type TelemetryPayload = { event: TelemetryEvent; timestamp: string; path: string; locale: string; properties: TelemetryProperties };
const DEFAULT_ENDPOINT = '/api/telemetry';

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase().split('-')[0] || 'en';
}

export function trackUserMovement(event: TelemetryEvent, locale: string, properties: TelemetryProperties = {}, endpoint = DEFAULT_ENDPOINT): void {
  if (typeof window === 'undefined') return;
  const payload: TelemetryPayload = { event, timestamp: new Date().toISOString(), path: window.location.pathname, locale: normalizeLocale(locale), properties };
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: 'application/json' });
  try {
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, blob)) return;
  } catch { /* fall through to keepalive fetch */ }
  void fetch(endpoint, { method: 'POST', body, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
}
