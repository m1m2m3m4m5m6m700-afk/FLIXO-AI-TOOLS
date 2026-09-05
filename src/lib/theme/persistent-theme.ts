export const THEME_STORAGE_KEY = 'flixo.theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  try {
    return normalizeThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function persistTheme(storage: Pick<Storage, 'setItem'> | null | undefined, preference: ThemePreference): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
}

export function applyTheme(documentRoot: HTMLElement, preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark);
  documentRoot.dataset.theme = resolved;
  documentRoot.style.colorScheme = resolved;
  return resolved;
}

export function installPersistentTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = readStoredTheme(window.localStorage);

  const apply = () => {
    applyTheme(document.documentElement, preference, media.matches);
  };

  const onSystemThemeChange = () => {
    if (preference === 'system') apply();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    preference = normalizeThemePreference(event.newValue);
    apply();
  };

  apply();
  media.addEventListener?.('change', onSystemThemeChange);
  window.addEventListener('storage', onStorage);

  return () => {
    media.removeEventListener?.('change', onSystemThemeChange);
    window.removeEventListener('storage', onStorage);
  };
}
