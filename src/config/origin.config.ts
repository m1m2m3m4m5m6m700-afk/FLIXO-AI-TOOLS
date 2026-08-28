const configuredSiteOrigin =
  import.meta.env?.VITE_SITE_URL?.trim() ||
  globalThis.process?.env?.VITE_SITE_URL?.trim();

const normalizeOrigin = (value: string): string => {
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
};

const isBlockedDeploymentOrigin = (origin: URL): boolean => (
  origin.hostname === 'localhost' ||
  origin.hostname === '127.0.0.1' ||
  origin.hostname === 'vercel.app' ||
  origin.hostname.endsWith('.vercel.app') ||
  origin.hostname.endsWith('.vercel.sh')
);

/**
 * Canonical SEO origin is a production configuration, never a deployment fallback.
 */
export function getCanonicalSiteOrigin(): string {
  if (!configuredSiteOrigin) {
    throw new Error(
      'VITE_SITE_URL is required for canonical SEO generation. Configure SITE_URL/VITE_SITE_URL with the real public HTTPS production origin.',
    );
  }

  const normalized = normalizeOrigin(configuredSiteOrigin);
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error('VITE_SITE_URL must use HTTPS.');
  }

  if (isBlockedDeploymentOrigin(origin)) {
    throw new Error(
      `VITE_SITE_URL must be the real public production origin, not a local or deployment origin: ${origin.origin}`,
    );
  }

  return normalized;
}

export function getRuntimeSiteOrigin(): string {
  if (configuredSiteOrigin) return normalizeOrigin(configuredSiteOrigin);
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://127.0.0.1:3000';
}
