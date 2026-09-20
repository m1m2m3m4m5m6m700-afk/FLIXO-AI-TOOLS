export type TelemetryEvent = 'ad_impression' | 'ad_clicked' | (string & {});

type TelemetryProperties = Record<string, string | number | boolean | null | undefined>;

type TelemetryPayload = {
  event: TelemetryEvent;
  timestamp: string;
  path: string;
  locale: string;
  properties: TelemetryProperties;
};

const CONFIGURED_ENDPOINT = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_TELEMETRY_ENDPOINT : undefined;

function getRuntimeContext() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { path: '', locale: 'en' };
  }

  const path = window.location.pathname;
  const locale = document.documentElement.lang.toLowerCase().split('-')[0] || 'en';
  return { path, locale };
}

/**
 * Fire-and-forget browser telemetry. Telemetry is opt-in: without a configured
 * endpoint we do nothing, so the application never emits requests to a route
 * that the deployment does not provide.
 */
export function trackUserMovement(
  event: TelemetryEvent,
  properties: TelemetryProperties = {},
  endpoint = CONFIGURED_ENDPOINT,
): void {
  if (typeof window === 'undefined' || !endpoint) return;

  const context = getRuntimeContext();
  const payload: TelemetryPayload = {
    event,
    timestamp: new Date().toISOString(),
    path: context.path,
    locale: context.locale,
    properties,
  };

  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: 'application/json' });

  try {
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, blob)) {
      return;
    }
  } catch {
    // Fall through to fetch(keepalive); telemetry must never affect UX.
  }

  void fetch(endpoint, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}
