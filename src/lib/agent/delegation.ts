export type AgentDelegatedTask<T> = Readonly<{
  id: string;
  input: T;
  resourceKeys?: readonly string[];
}>;

export type AgentTaskResult<T, R> = Readonly<{
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED';
  input: T;
  output?: R;
  error?: unknown;
}>;

export class AgentResourceLockManager {
  private readonly owners = new Map<string, string>();

  tryAcquire(keys: readonly string[], owner: string): boolean {
    const normalized = [...new Set(keys.map((key) => key.trim()).filter(Boolean))].sort();
    if (!owner.trim() || normalized.some((key) => this.owners.has(key))) return false;
    for (const key of normalized) this.owners.set(key, owner);
    return true;
  }

  release(keys: readonly string[], owner: string): void {
    for (const key of new Set(keys.map((item) => item.trim()).filter(Boolean))) {
      if (this.owners.get(key) === owner) this.owners.delete(key);
    }
  }

  ownerOf(key: string): string | undefined {
    return this.owners.get(key);
  }

  clear(): void {
    this.owners.clear();
  }
}

export async function runBoundedParallel<T, R>(
  tasks: readonly AgentDelegatedTask<T>[],
  worker: (task: AgentDelegatedTask<T>) => Promise<R>,
  options: Readonly<{
    maxConcurrency?: number;
    lockManager?: AgentResourceLockManager;
  }> = {},
): Promise<readonly AgentTaskResult<T, R>[]> {
  const maxConcurrency = Math.max(1, Math.min(8, Math.floor(options.maxConcurrency ?? 3)));
  const lockManager = options.lockManager ?? new AgentResourceLockManager();
  const pending = tasks.map((task, index) => ({ task, index }));
  const results: Array<AgentTaskResult<T, R> | undefined> = new Array(tasks.length);

  async function consume(): Promise<void> {
    while (pending.length > 0) {
      const candidate = pending.shift();
      if (!candidate) return;

      const task = candidate.task;
      const owner = task.id;
      const keys = task.resourceKeys ?? [];

      if (!lockManager.tryAcquire(keys, owner)) {
        pending.push(candidate);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        continue;
      }

      try {
        const output = await worker(task);
        results[candidate.index] = Object.freeze({
          taskId: task.id,
          status: 'COMPLETED',
          input: task.input,
          output,
        });
      } catch (error) {
        results[candidate.index] = Object.freeze({
          taskId: task.id,
          status: 'FAILED',
          input: task.input,
          error,
        });
      } finally {
        lockManager.release(keys, owner);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => consume(),
  );
  await Promise.all(workers);
  return Object.freeze(
    results.filter((result): result is AgentTaskResult<T, R> => result !== undefined),
  );
}
