const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';
const DEFAULT_TEST_ORIGIN = 'https://canonical.test';
const OFFICIAL_PRODUCTION_ORIGIN = 'https://flixoai.vercel.app';

function readOriginEnv(name: 'VITE_SITE_URL' | 'VITE_RUNTIME_ORIGIN' | 'VITE_TEST_ORIGIN'): string | undefined {
  const configured =
    import.meta.env?.[name]?.trim() ||
    globalThis.process?.env?.[name]?.trim();
  return configured || undefined;
}

function normalizeOrigin(value: string, variableName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute URL: ${value}`);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${variableName} must not contain credentials, query parameters, or fragments.`);
  }

  return parsed.origin.replace(/\/$/u, '');
}

export function getCanonicalSiteOrigin(): string {
  const configured = readOriginEnv('VITE_SITE_URL');
  if (!configured) {
    throw new Error(
      'VITE_SITE_URL is required for canonical SEO generation. Configure SITE_URL/VITE_SITE_URL with the official production origin.',
    );
  }

  const normalized = normalizeOrigin(configured, 'VITE_SITE_URL');
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error('VITE_SITE_URL must use HTTPS.');
  }

  if (origin.origin !== OFFICIAL_PRODUCTION_ORIGIN) {
    throw new Error(
      `VITE_SITE_URL must be the sole official FLIXO production origin: ${OFFICIAL_PRODUCTION_ORIGIN}`,
    );
  }

  return normalized;
}

export function getRuntimeSiteOrigin(): string {
  const configured = readOriginEnv('VITE_RUNTIME_ORIGIN');
  if (configured) return normalizeOrigin(configured, 'VITE_RUNTIME_ORIGIN');
  if (typeof window !== 'undefined') return window.location.origin;
  return DEFAULT_RUNTIME_ORIGIN;
}

export function getTestSiteOrigin(): string {
  const configured = readOriginEnv('VITE_TEST_ORIGIN');
  return configured ? normalizeOrigin(configured, 'VITE_TEST_ORIGIN') : DEFAULT_TEST_ORIGIN;
}
