import { useEffect, useState } from 'react';

type Disposer = () => void | Promise<void>;
export type WorkerJobEvent<TResponse> =
  | { type: 'start' }
  | { type: 'progress'; value: number }
  | { type: 'abort' }
  | { type: 'error'; error: unknown }
  | { type: 'done'; response: TResponse }
  | { type: 'dispose' };
export interface WorkerJob<TRequest, TResponse> {
  readonly start: (request: TRequest, signal: AbortSignal) => Promise<TResponse>;
  readonly dispose: () => void | Promise<void>;
}
export class DisposableResourceOwner {
  private readonly resources = new Map<string, Disposer>();
  private readonly pendingDisposals = new Set<Promise<void>>();
  track<T>(key: string, resource: T, dispose: (resource: T) => void | Promise<void>): T {
    const previous = this.resources.get(key);
    if (previous) {
      this.resources.delete(key);
      const pending = Promise.resolve().then(previous).then(() => undefined);
      this.pendingDisposals.add(pending);
      void pending.finally(() => this.pendingDisposals.delete(pending));
    }
    this.resources.set(key, () => dispose(resource));
    return resource;
  }
  async dispose(key: string): Promise<void> {
    const disposer = this.resources.get(key);
    this.resources.delete(key);
    if (!disposer) return;
    try { await disposer(); } finally { this.resources.delete(key); }
  }
  async disposeAll(): Promise<void> {
    const entries = Array.from(this.resources.keys()).reverse();
    try { for (const key of entries) await this.dispose(key); await Promise.allSettled(Array.from(this.pendingDisposals)); }
    finally { this.resources.clear(); }
  }
  objectUrl(key: string, value: Blob | MediaSource): string {
    const url = URL.createObjectURL(value);
    this.track(key, url, (ownedUrl) => URL.revokeObjectURL(ownedUrl));
    return url;
  }
  worker(key: string, worker: Worker): Worker { return this.track(key, worker, (ownedWorker) => ownedWorker.terminate()); }
  audioContext<T extends AudioContext>(key: string, context: T): T {
    return this.track(key, context, async (ownedContext) => { if (ownedContext.state !== 'closed') await ownedContext.close(); });
  }
}
export function useDisposableResourceOwner(): DisposableResourceOwner {
  const [owner] = useState(() => new DisposableResourceOwner());
  useEffect(() => () => { void owner.disposeAll(); }, [owner]);
  return owner;
}
export const useDisposableResource = useDisposableResourceOwner;
export function createAbortError(): DOMException { return new DOMException('The operation was aborted.', 'AbortError'); }
export function throwIfAborted(signal: AbortSignal): void { if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : createAbortError(); }
