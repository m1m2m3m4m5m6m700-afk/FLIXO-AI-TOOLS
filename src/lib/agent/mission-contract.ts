import { createTaskContext, transitionTask, type TaskContext, type TaskState } from '@flixo/agent-runtime';
import type { DecomposedTask, TaskDecomposition } from '@flixo/agent-runtime';

const SHA40 = /^[a-f0-9]{40}$/u;

export type MissionEvidenceKind =
  | 'PLAN'
  | 'EXECUTION'
  | 'VERIFICATION'
  | 'SECURITY'
  | 'RECOVERY';

export type MissionEvidence = Readonly<{
  id: string;
  missionId: string;
  taskId: string;
  exactSha: string;
  kind: MissionEvidenceKind;
  claim: string;
  verified: boolean;
  source: string;
  capturedAt: string;
}>;

export type MissionTask = Readonly<{
  task: DecomposedTask;
  context: TaskContext;
  evidenceIds: readonly string[];
}>;

export type MissionContract = Readonly<{
  missionId: string;
  traceId: string;
  exactSha: string;
  objective: string;
  createdAt: string;
  tasks: readonly MissionTask[];
  evidence: readonly MissionEvidence[];
}>;

function assertIdentity(value: string, code: string): void {
  const hasControlCharacter = [...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d || point === 0x7f;
  });
  if (!value.trim() || value.length > 256 || hasControlCharacter) throw new Error(code);
}

function assertSha(value: string, code: string): void {
  if (!SHA40.test(value)) throw new Error(code);
}

function assertGraph(tasks: readonly DecomposedTask[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    assertIdentity(task.id, 'MISSION_TASK_ID_INVALID');
    if (ids.has(task.id)) throw new Error(`MISSION_TASK_ID_COLLISION=${task.id}`);
    ids.add(task.id);
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error('MISSION_TASK_GRAPH_CYCLE');
    const task = byId.get(id);
    if (!task) throw new Error(`MISSION_TASK_DEPENDENCY_MISSING=${id}`);
    visiting.add(id);
    for (const dependency of task.dependencies) {
      if (!byId.has(dependency)) throw new Error(`MISSION_TASK_DEPENDENCY_MISSING=${dependency}`);
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const task of tasks) visit(task.id);
}

export function createMissionContract(input: {
  missionId: string;
  traceId: string;
  exactSha: string;
  objective: string;
  decomposition: TaskDecomposition;
  createdAt?: string;
}): MissionContract {
  assertIdentity(input.missionId, 'MISSION_ID_INVALID');
  assertIdentity(input.traceId, 'MISSION_TRACE_ID_INVALID');
  assertIdentity(input.objective, 'MISSION_OBJECTIVE_INVALID');
  assertSha(input.exactSha, 'MISSION_EXACT_SHA_INVALID');
  if (!input.decomposition.tasks.length) throw new Error('MISSION_TASK_GRAPH_EMPTY');
  assertGraph(input.decomposition.tasks);

  const tasks = input.decomposition.tasks.map((task) => Object.freeze({
    task,
    context: transitionTask(createTaskContext(task.id, input.traceId), 'PLANNED'),
    evidenceIds: Object.freeze([]),
  }));

  return Object.freeze({
    missionId: input.missionId,
    traceId: input.traceId,
    exactSha: input.exactSha,
    objective: input.objective,
    createdAt: input.createdAt ?? new Date().toISOString(),
    tasks: Object.freeze(tasks),
    evidence: Object.freeze([]),
  });
}

function getMissionTask(mission: MissionContract, taskId: string): MissionTask {
  const task = mission.tasks.find((candidate) => candidate.task.id === taskId);
  if (!task) throw new Error(`MISSION_TASK_NOT_FOUND=${taskId}`);
  return task;
}

function dependenciesComplete(mission: MissionContract, task: MissionTask): boolean {
  return task.task.dependencies.every((dependency) =>
    getMissionTask(mission, dependency).context.state === 'COMPLETED',
  );
}

export function canExecuteMissionTask(mission: MissionContract, taskId: string): boolean {
  const task = getMissionTask(mission, taskId);
  return task.context.state === 'PLANNED' && dependenciesComplete(mission, task);
}

export function transitionMissionTask(
  mission: MissionContract,
  taskId: string,
  nextState: TaskState,
): MissionContract {
  const current = getMissionTask(mission, taskId);

  if (nextState === 'EXECUTING' && !dependenciesComplete(mission, current)) {
    throw new Error(`MISSION_TASK_DEPENDENCIES_INCOMPLETE=${taskId}`);
  }

  const context = transitionTask(current.context, nextState);
  const tasks = mission.tasks.map((candidate) =>
    candidate.task.id === taskId ? Object.freeze({ ...candidate, context }) : candidate,
  );

  return Object.freeze({
    ...mission,
    tasks: Object.freeze(tasks),
  });
}

export function recordMissionEvidence(
  mission: MissionContract,
  evidence: Omit<MissionEvidence, 'missionId' | 'exactSha'> & { missionId?: string; exactSha?: string },
): MissionContract {
  const task = getMissionTask(mission, evidence.taskId);
  const missionId = evidence.missionId ?? mission.missionId;
  const exactSha = evidence.exactSha ?? mission.exactSha;

  if (missionId !== mission.missionId) throw new Error('MISSION_EVIDENCE_MISSION_MISMATCH');
  if (exactSha !== mission.exactSha) throw new Error('MISSION_EVIDENCE_SHA_MISMATCH');
  assertIdentity(evidence.id, 'MISSION_EVIDENCE_ID_INVALID');
  assertIdentity(evidence.claim, 'MISSION_EVIDENCE_CLAIM_INVALID');
  assertIdentity(evidence.source, 'MISSION_EVIDENCE_SOURCE_INVALID');
  assertSha(exactSha, 'MISSION_EVIDENCE_EXACT_SHA_INVALID');
  if (mission.evidence.some((candidate) => candidate.id === evidence.id)) {
    throw new Error(`MISSION_EVIDENCE_ID_COLLISION=${evidence.id}`);
  }
  if (evidence.verified && !['VERIFYING', 'COMPLETED'].includes(task.context.state)) {
    throw new Error('MISSION_VERIFIED_EVIDENCE_REQUIRES_VERIFICATION_STATE');
  }

  const captured = Object.freeze({
    id: evidence.id,
    missionId,
    taskId: evidence.taskId,
    exactSha,
    kind: evidence.kind,
    claim: evidence.claim,
    verified: evidence.verified,
    source: evidence.source,
    capturedAt: evidence.capturedAt,
  });

  const taskUpdated = Object.freeze({
    ...task,
    evidenceIds: Object.freeze([...task.evidenceIds, captured.id]),
  });

  return Object.freeze({
    ...mission,
    tasks: Object.freeze(
      mission.tasks.map((candidate) =>
        candidate.task.id === task.task.id ? taskUpdated : candidate,
      ),
    ),
    evidence: Object.freeze([...mission.evidence, captured]),
  });
}

export function assertMissionComplete(mission: MissionContract): void {
  if (mission.tasks.some((task) => task.context.state !== 'COMPLETED')) {
    throw new Error('MISSION_INCOMPLETE_TASKS');
  }

  for (const task of mission.tasks) {
    const verifiedEvidence = task.evidenceIds
      .map((id) => mission.evidence.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is MissionEvidence => Boolean(candidate))
      .some((candidate) => candidate.verified && candidate.exactSha === mission.exactSha);
    if (!verifiedEvidence) throw new Error(`MISSION_VERIFIED_EVIDENCE_MISSING=${task.task.id}`);
  }
}

export function missionStatus(mission: MissionContract):
  | 'PLANNED'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED' {
  const states = mission.tasks.map((task) => task.context.state);
  if (states.every((state) => state === 'COMPLETED')) return 'COMPLETED';
  if (states.some((state) => state === 'FAILED')) return 'FAILED';
  if (states.some((state) => state === 'CANCELLED')) return 'CANCELLED';
  if (states.some((state) => state === 'VERIFYING')) return 'VERIFYING';
  if (states.some((state) => state === 'EXECUTING' || state === 'RECOVERING')) return 'EXECUTING';
  return 'PLANNED';
}
