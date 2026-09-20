import { parsePersistedToolIds } from './runtime-boundaries.ts';

const FAVORITES_KEY = 'flixo:favorites:v1';
const RECENTS_KEY = 'flixo:recents:v1';
const MAX_RECENTS = 8;
const MAX_FAVORITES = 50;

const readArray = (key: string, maxEntries: number): string[] => {
  const value = localStorage.getItem(key);
  if (value === null) return [];

  try {
    return parsePersistedToolIds(JSON.parse(value), maxEntries);
  } catch (error) {
    localStorage.removeItem(key);
    console.error('[FLIXO][boundary] Purged invalid local-workspace persistence.', { key, error });
    return [];
  }
};

const writeArray = (key: string, values: string[], maxEntries: number) => {
  try {
    const normalized = parsePersistedToolIds(values, maxEntries);
    localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.error('[FLIXO][boundary] Refused invalid local-workspace write.', { key, error });
    return readArray(key, maxEntries);
  }
};

export const getFavorites = () => readArray(FAVORITES_KEY, MAX_FAVORITES);
export const getRecentTools = () => readArray(RECENTS_KEY, MAX_RECENTS);

export const toggleFavorite = (toolId: string) => {
  const current = getFavorites();
  const next = current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId];
  return writeArray(FAVORITES_KEY, next.slice(0, MAX_FAVORITES), MAX_FAVORITES);
};

export const recordRecentTool = (toolId: string) => {
  const next = [toolId, ...getRecentTools().filter((id) => id !== toolId)].slice(0, MAX_RECENTS);
  return writeArray(RECENTS_KEY, next, MAX_RECENTS);
};
