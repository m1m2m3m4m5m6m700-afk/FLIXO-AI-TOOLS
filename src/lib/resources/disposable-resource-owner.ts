import { useEffect, useRef } from 'react';

type Disposer = () => void | Promise<void>;

export class DisposableResourceOwner {
  private readonly resources = new Map<string, Disposer>();

  track<T>(key: string, resource: T, dispose: (resource: T) => void | Promise<void>): T {
    void this.dispose(key);
    this.resources.set(key, () => dispose(resource));
    return resource;
  }

  async dispose(key: string): Promise<void> {
    const disposer = this.resources.get(key);
    this.resources.delete(key);
    if (!disposer) return;
    try {
      await disposer();
    } finally {
      this.resources.delete(key);
    }
  }

  async disposeAll(): Promise<void> {
    const entries = Array.from(this.resources.keys()).reverse();
    try {
      for (const key of entries) {
        await this.dispose(key);
      }
    } finally {
      this.resources.clear();
    }
  }

  objectUrl(key: string, value: Blob | MediaSource): string {
    const url = URL.createObjectURL(value);
    this.track(key, url, (ownedUrl) => URL.revokeObjectURL(ownedUrl));
    return url;
  }

  worker(key: string, worker: Worker): Worker {
    return this.track(key, worker, (ownedWorker) => ownedWorker.terminate());
  }

  audioContext<T extends BaseAudioContext>(key: string, context: T): T {
    return this.track(key, context, async (ownedContext) => {
      if (ownedContext.state !== 'closed') {
        await ownedContext.close();
      }
    });
  }
}

export function useDisposableResourceOwner(): DisposableResourceOwner {
  const ownerRef = useRef<DisposableResourceOwner | null>(null);
  if (!ownerRef.current) ownerRef.current = new DisposableResourceOwner();
  const owner = ownerRef.current;

  useEffect(() => () => {
    void owner.disposeAll();
  }, [owner]);

  return owner;
}

export function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : createAbortError();
}
