import { z } from 'zod';
import type { ExecutionPlanContract } from '@/lib/contracts/ai-plan.ts';

export const LAYERED_MEMORY_VERSION = 1 as const;

export type MemoryLayer = 'TASK' | 'CONVERSATION' | 'USER' | 'PROJECT' | 'VERIFIED';
export type MemorySource = 'USER' | 'TOOL' | 'SYSTEM' | 'MEMORY' | 'MODEL';
export type MemoryState = 'VERIFIED' | 'PROBABLE' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTED';

export type MemoryItem = Readonly<{
  id: string;
  layer: MemoryLayer;
  key: string;
  value: string;
  source: MemorySource;
  state: MemoryState;
  confidence: number;
  evidenceRefs: readonly string[];
  updatedAt: string;
}>;

export type LayeredMemorySnapshot = Readonly<{
  version: typeof LAYERED_MEMORY_VERSION;
  taskId: string | null;
  items: readonly MemoryItem[];
}>;

const MemoryItemSchema = z.object({
  id: z.string().trim().min(1).max(256),
  layer: z.enum(['TASK', 'CONVERSATION', 'USER', 'PROJECT', 'VERIFIED']),
  key: z.string().trim().min(1).max(256),
  value: z.string().trim().max(8_000),
  source: z.enum(['USER', 'TOOL', 'SYSTEM', 'MEMORY', 'MODEL']),
  state: z.enum(['VERIFIED', 'PROBABLE', 'INFERRED', 'UNKNOWN', 'CONFLICTED']),
  confidence: z.number().finite().min(0).max(1),
  evidenceRefs: z.array(z.string().trim().min(1).max(512)).max(32),
  updatedAt: z.string().datetime(),
}).strict();

export const LayeredMemorySchema = z.object({
  version: z.literal(LAYERED_MEMORY_VERSION),
  taskId: z.string().trim().max(256).nullable(),
  items: z.array(MemoryItemSchema).max(128),
}).strict();

export function parseLayeredMemory(value: unknown): LayeredMemorySnapshot {
  return Object.freeze(LayeredMemorySchema.parse(value));
}

export function createLayeredMemory(taskId: string | null = null): LayeredMemorySnapshot {
  return Object.freeze({
    version: LAYERED_MEMORY_VERSION,
    taskId,
    items: Object.freeze([]),
  });
}

function idFor(layer: MemoryLayer, key: string): string {
  return `${layer.toLocaleLowerCase()}:${key.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}_.:-]+/gu, '-')}`;
}

export function rememberMemory(
  snapshot: LayeredMemorySnapshot,
  input: Omit<MemoryItem, 'id' | 'updatedAt'> & { id?: string },
): LayeredMemorySnapshot {
  const next: MemoryItem = Object.freeze({
    id: input.id?.trim() || idFor(input.layer, input.key),
    layer: input.layer,
    key: input.key.trim(),
    value: input.value.trim(),
    source: input.source,
    state: input.state,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    evidenceRefs: Object.freeze([...input.evidenceRefs].slice(0, 32)),
    updatedAt: new Date().toISOString(),
  });

  const items = [
    ...snapshot.items.filter((item) => item.id !== next.id),
    next,
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 128);

  return Object.freeze({
    ...snapshot,
    items: Object.freeze(items),
  });
}

export function deriveLayeredMemorySnapshot(input: {
  activeCommand?: string | null;
  activeToolId?: string | null;
  pendingQuestion?: string | null;
  taskId?: string | null;
  turns?: readonly Readonly<{ role: 'user' | 'agent'; text: string }>[];
  activePlan?: ExecutionPlanContract | null;
}): LayeredMemorySnapshot {
  let snapshot = createLayeredMemory(input.taskId ?? null);

  if (input.activeCommand?.trim()) {
    snapshot = rememberMemory(snapshot, {
      layer: 'TASK',
      key: 'active.command',
      value: input.activeCommand,
      source: 'MEMORY',
      state: 'PROBABLE',
      confidence: 0.95,
      evidenceRefs: ['conversation.activeCommand'],
    });
  }

  if (input.activeToolId?.trim()) {
    snapshot = rememberMemory(snapshot, {
      layer: 'TASK',
      key: 'active.tool',
      value: input.activeToolId,
      source: 'TOOL',
      state: 'PROBABLE',
      confidence: 0.9,
      evidenceRefs: ['conversation.activeToolId'],
    });
  }

  if (input.pendingQuestion?.trim()) {
    snapshot = rememberMemory(snapshot, {
      layer: 'TASK',
      key: 'pending.question',
      value: input.pendingQuestion,
      source: 'MEMORY',
      state: 'VERIFIED',
      confidence: 1,
      evidenceRefs: ['conversation.pendingQuestion'],
    });
  }

  if (input.activePlan) {
    snapshot = rememberMemory(snapshot, {
      layer: 'TASK',
      key: 'active.plan',
      value: JSON.stringify({
        workflowName: input.activePlan.workflowName,
        confidence: input.activePlan.confidence,
        steps: input.activePlan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
      }),
      source: 'TOOL',
      state: 'VERIFIED',
      confidence: 1,
      evidenceRefs: ['conversation.activePlan'],
    });
  }

  const turns = input.turns ?? [];
  const recentUserTurns = turns.filter((turn) => turn.role === 'user').slice(-6);
  for (let index = 0; index < recentUserTurns.length; index += 1) {
    const turn = recentUserTurns[index];
    snapshot = rememberMemory(snapshot, {
      layer: 'CONVERSATION',
      key: `recent.user.${index + 1}`,
      value: turn.text,
      source: 'USER',
      state: 'VERIFIED',
      confidence: 1,
      evidenceRefs: [`conversation.turn.${index + 1}`],
    });
  }

  return snapshot;
}

export function toPromptMemory(snapshot: LayeredMemorySnapshot, maxItems = 24): readonly Record<string, unknown>[] {
  return Object.freeze(
    snapshot.items.slice(0, Math.max(0, Math.min(48, maxItems))).map((item) => ({
      layer: item.layer,
      key: item.key,
      value: item.value,
      source: item.source,
      state: item.state,
      confidence: item.confidence,
      evidenceRefs: item.evidenceRefs,
    })),
  );
}
