const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';

function readConfiguredSiteOrigin(): string | undefined {
  const configured =
    import.meta.env?.VITE_SITE_URL?.trim() ||
    globalThis.process?.env?.VITE_SITE_URL?.trim();
  return configured || undefined;
}

function normalizeOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`VITE_SITE_URL must be an absolute URL: ${value}`);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('VITE_SITE_URL must not contain credentials, query parameters, or fragments.');
  }

  return parsed.origin.replace(/\/$/u, '');
}

function isBlockedCanonicalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1' ||
    normalized === 'vercel.app' ||
    normalized.endsWith('.vercel.app') ||
    normalized === 'vercel.sh' ||
    normalized.endsWith('.vercel.sh')
  );
}

/**
 * Production canonical origin is explicit and deterministic.
 * Deployment/preview metadata is intentionally not accepted as canonical.
 */
export function getCanonicalSiteOrigin(): string {
  const configured = readConfiguredSiteOrigin();
  if (!configured) {
    throw new Error(
      'VITE_SITE_URL is required for canonical SEO generation. Configure SITE_URL/VITE_SITE_URL with the real public HTTPS production origin.',
    );
  }

  const normalized = normalizeOrigin(configured);
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error('VITE_SITE_URL must use HTTPS.');
  }

  if (isBlockedCanonicalHost(origin.hostname)) {
    throw new Error(
      `VITE_SITE_URL must be the real public production origin, not a local or deployment origin: ${origin.origin}`,
    );
  }

  return normalized;
}

/**
 * Runtime/browser origin is independent from canonical SEO metadata.
 * In a browser, the current deployment origin is used. In Node, a local
 * deterministic target keeps runtime-only imports usable without pretending
 * that the local server is a production canonical origin.
 */
export function getRuntimeSiteOrigin(): string {
  const configured = readConfiguredSiteOrigin();
  if (configured) return normalizeOrigin(configured);
  if (typeof window !== 'undefined') return window.location.origin;
  return DEFAULT_RUNTIME_ORIGIN;
}
