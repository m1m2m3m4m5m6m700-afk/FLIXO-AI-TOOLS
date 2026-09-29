import type { RenderNode, RenderBackend } from './types';

export type RenderCacheKey = string;
export type RenderCacheEntry<T=unknown> = Readonly<{key:RenderCacheKey; backend:RenderBackend; value:T; bytes:number}>;

export function createRenderCacheKey(node: RenderNode, inputKeys: readonly string[] = []): RenderCacheKey {
  const payload = JSON.stringify({id:node.id,operation:node.operation,parameters:node.parameters,inputKeys:[...inputKeys].sort()});
  return payload;
}

export function createRenderCache<T=unknown>(maxBytes=64*1024*1024) {
  const entries=new Map<RenderCacheKey,RenderCacheEntry<T>>(); let bytes=0;
  return {
    get(key:RenderCacheKey){return entries.get(key);},
    set(entry:RenderCacheEntry<T>){ if(entry.bytes<0 || entry.bytes>maxBytes) throw new Error('RENDER_CACHE_ENTRY_OUT_OF_BOUNDS'); const prior=entries.get(entry.key); if(prior) bytes-=prior.bytes; entries.set(entry.key,entry); bytes+=entry.bytes; while(bytes>maxBytes){const first=entries.keys().next().value as RenderCacheKey|undefined; if(!first) break; const old=entries.get(first)!; entries.delete(first); bytes-=old.bytes;}},
    clear(){entries.clear();bytes=0;},
    stats(){return {entries:entries.size,bytes,maxBytes};}
  };
}
