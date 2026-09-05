import { createHash } from 'node:crypto';
import type { ClassifiedFailure, FailureEvent } from './taxonomy.ts';
import { classifyFailure } from './taxonomy.ts';

export interface RootCauseGroup {
  rootCauseId: string;
  classification: ClassifiedFailure['classification'];
  confidence: ClassifiedFailure['confidence'];
  occurrences: number;
  contracts: string[];
  routes: string[];
  locales: string[];
  messages: string[];
}

export interface FailureReport {
  schemaVersion: 1;
  rootCauses: RootCauseGroup[];
  failures: ClassifiedFailure[];
  unknownCount: number;
  reportHash: string;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export function aggregateFailures(events: readonly FailureEvent[]): FailureReport {
  const failures = events.map(classifyFailure);
  const groups = new Map<string, RootCauseGroup>();
  for (const failure of failures) {
    const group = groups.get(failure.rootCauseId) ?? {
      rootCauseId: failure.rootCauseId,
      classification: failure.classification,
      confidence: failure.confidence,
      occurrences: 0,
      contracts: [], routes: [], locales: [], messages: [],
    };
    group.occurrences += 1;
    if (!group.contracts.includes(failure.contract)) group.contracts.push(failure.contract);
    if (failure.route && !group.routes.includes(failure.route)) group.routes.push(failure.route);
    if (failure.locale && !group.locales.includes(failure.locale)) group.locales.push(failure.locale);
    if (!group.messages.includes(failure.message)) group.messages.push(failure.message);
    if (failure.confidence === 'LOW') group.confidence = 'LOW';
    else if (failure.confidence === 'MEDIUM' && group.confidence === 'HIGH') group.confidence = 'MEDIUM';
    groups.set(failure.rootCauseId, group);
  }
  const rootCauses = [...groups.values()].map((group) => ({
    ...group,
    contracts: [...group.contracts].sort(),
    routes: [...group.routes].sort(),
    locales: [...group.locales].sort(),
    messages: [...group.messages].sort(),
  })).sort((a, b) => b.occurrences - a.occurrences || a.rootCauseId.localeCompare(b.rootCauseId));
  const body = { schemaVersion: 1 as const, rootCauses, failures, unknownCount: failures.filter((f) => f.classification === 'UNKNOWN').length };
  return { ...body, reportHash: hash(body) };
}
