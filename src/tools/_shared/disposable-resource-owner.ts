export type Disposable = () => void;

/** Central lifecycle owner for browser resources that require deterministic disposal. */
export class DisposableResourceOwner {
  private readonly disposables = new Set<Disposable>();
  private readonly objectUrlReleases = new Map<string, Disposable>();

  track(disposable: Disposable): Disposable {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.disposables.delete(release);
      disposable();
    };
    this.disposables.add(release);
    return release;
  }

  createObjectURL(value: Blob | MediaSource): string {
    const url = URL.createObjectURL(value);
    const release = this.track(() => URL.revokeObjectURL(url));
    this.objectUrlReleases.set(url, release);
    return url;
  }

  revokeObjectURL(url: string): void {
    const release = this.objectUrlReleases.get(url);
    if (!release) return;
    this.objectUrlReleases.delete(url);
    release();
  }

  trackWorker(worker: Worker): Worker {
    this.track(() => worker.terminate());
    return worker;
  }

  dispose(): void {
    const resources = [...this.disposables];
    this.objectUrlReleases.clear();
    this.disposables.clear();
    for (const release of resources) release();
  }
}
