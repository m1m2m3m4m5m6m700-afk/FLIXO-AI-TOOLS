import type { RenderNode, RenderBackend } from './types';

export type RenderCacheKey = string;
export type RenderCacheEntry<T = unknown> = Readonly<{
  key: RenderCacheKey;
  backend: RenderBackend;
  value: T;
  bytes: number;
}>;

export type RenderCacheContext = Readonly<{
  documentVersion: number;
  renderVersion: number;
  inputFingerprint: string;
}>;

export function createRenderCacheKey(
  node: RenderNode,
  inputKeys: readonly string[] = [],
  context?: RenderCacheContext,
): RenderCacheKey {
  const payload = {
    schema: 2,
    context: context ? {
      documentVersion: context.documentVersion,
      renderVersion: context.renderVersion,
      inputFingerprint: context.inputFingerprint,
    } : null,
    id: node.id,
    operation: node.operation,
    parameters: node.parameters,
    inputKeys: [...inputKeys].sort(),
  };
  return JSON.stringify(payload);
}

export function createRenderCache<T = unknown>(maxBytes = 64 * 1024 * 1024) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('RENDER_CACHE_BUDGET_INVALID');
  const entries = new Map<RenderCacheKey, RenderCacheEntry<T>>();
  let bytes = 0;

  const remove = (key: RenderCacheKey): void => {
    const prior = entries.get(key);
    if (!prior) return;
    entries.delete(key);
    bytes -= prior.bytes;
  };

  return {
    get(key: RenderCacheKey) { return entries.get(key); },
    set(entry: RenderCacheEntry<T>) {
      if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > maxBytes) throw new Error('RENDER_CACHE_ENTRY_OUT_OF_BOUNDS');
      remove(entry.key);
      entries.set(entry.key, Object.freeze({ ...entry }));
      bytes += entry.bytes;
      while (bytes > maxBytes) {
        const first = entries.keys().next().value as RenderCacheKey | undefined;
        if (first === undefined) break;
        remove(first);
      }
    },
    delete(key: RenderCacheKey) { remove(key); },
    clear() { entries.clear(); bytes = 0; },
    stats() { return { entries: entries.size, bytes, maxBytes }; },
  };
}
