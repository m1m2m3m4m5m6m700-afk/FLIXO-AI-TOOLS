export type Disposable = () => void;

/** Central lifecycle owner for browser resources that require deterministic disposal. */
export class DisposableResourceOwner {
  private readonly disposables = new Set<Disposable>();

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
    this.track(() => URL.revokeObjectURL(url));
    return url;
  }

  trackWorker(worker: Worker): Worker {
    this.track(() => worker.terminate());
    return worker;
  }

  dispose(): void {
    const resources = [...this.disposables];
    this.disposables.clear();
    for (const release of resources) release();
  }
}
