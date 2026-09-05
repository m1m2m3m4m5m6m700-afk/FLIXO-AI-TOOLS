import type { CiContract } from '../core/types.ts';

export interface InvalidationRule {
  pattern: string;
  invalidates: string[];
  reason: string;
}

export interface InvalidationDecision {
  changedFiles: string[];
  invalidatedContracts: string[];
  reasons: string[];
  conservative: boolean;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.split('**').map((part) => part.split('*').map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*');
  return new RegExp(`^${escaped}$`);
}

function matches(file: string, pattern: string): boolean {
  return patternToRegExp(pattern).test(file);
}

export function calculateInvalidation(changedFiles: readonly string[], contracts: readonly CiContract[], rules: readonly InvalidationRule[]): InvalidationDecision {
  const ids = new Set(contracts.map((contract) => contract.id));
  const invalidated = new Set<string>();
  const reasons = new Set<string>();
  let conservative = false;

  for (const file of changedFiles) {
    const matchesForFile = rules.filter((rule) => matches(file, rule.pattern));
    if (matchesForFile.length === 0) continue;
    for (const rule of matchesForFile) {
      reasons.add(rule.reason);
      for (const id of rule.invalidates) {
        if (!ids.has(id)) {
          conservative = true;
          for (const contract of contracts) invalidated.add(contract.id);
        } else invalidated.add(id);
      }
    }
  }

  return {
    changedFiles: [...changedFiles],
    invalidatedContracts: [...invalidated].sort(),
    reasons: [...reasons].sort(),
    conservative,
  };
}
