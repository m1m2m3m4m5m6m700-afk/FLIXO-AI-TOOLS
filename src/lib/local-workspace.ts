const FAVORITES_KEY = 'flixo:favorites:v1';
const RECENTS_KEY = 'flixo:recents:v1';
const MAX_RECENTS = 8;

const readArray = (key: string): string[] => {
  try {
    const value = localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeArray = (key: string, values: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Local persistence is an enhancement; never break the tool UI.
  }
};

export const getFavorites = () => readArray(FAVORITES_KEY);
export const getRecentTools = () => readArray(RECENTS_KEY);

export const toggleFavorite = (toolId: string) => {
  const current = getFavorites();
  const next = current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId];
  writeArray(FAVORITES_KEY, next.slice(0, 50));
  return next;
};

export const recordRecentTool = (toolId: string) => {
  const next = [toolId, ...getRecentTools().filter((id) => id !== toolId)].slice(0, MAX_RECENTS);
  writeArray(RECENTS_KEY, next);
  return next;
};
