const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';
const DEFAULT_TEST_ORIGIN = 'https://canonical.test';
const OFFICIAL_PRODUCTION_ORIGIN = 'https://flixoai.vercel.app';

type OriginEnvName = 'SITE_URL' | 'VITE_SITE_URL' | 'VITE_RUNTIME_ORIGIN' | 'VITE_TEST_ORIGIN';

function readOriginEnv(name: OriginEnvName): string | undefined {
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
  const viteConfigured = readOriginEnv('VITE_SITE_URL');
  const siteConfigured = readOriginEnv('SITE_URL');
  const configured = viteConfigured || siteConfigured;
  const configuredName = viteConfigured ? 'VITE_SITE_URL' : siteConfigured ? 'SITE_URL' : 'VITE_SITE_URL';
  const isVercelBuild = globalThis.process?.env?.VERCEL === '1';
  const isCanonicalCi =
    globalThis.process?.env?.GITHUB_ACTIONS === 'true' &&
    globalThis.process?.env?.GITHUB_WORKFLOW === 'CI';
  const raw = configured || (isVercelBuild || isCanonicalCi ? OFFICIAL_PRODUCTION_ORIGIN : undefined);

  if (!raw) {
    throw new Error(
      'SITE_URL/VITE_SITE_URL is required for canonical SEO generation outside approved Vercel/CI builds. Configure the official production origin.',
    );
  }

  const normalized = normalizeOrigin(raw, configuredName);
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error(`${configuredName} must use HTTPS.`);
  }

  if (origin.origin !== OFFICIAL_PRODUCTION_ORIGIN) {
    throw new Error(
      `${configuredName} must be the sole official FLIXO production origin: ${OFFICIAL_PRODUCTION_ORIGIN}`,
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
