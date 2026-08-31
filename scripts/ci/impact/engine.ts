import type { CiContract } from '../core/types.ts';

export interface ImpactRule {
  pattern: string;
  contracts: string[];
  escalateTo?: 'L0' | 'L1' | 'L2' | 'L3';
  reason: string;
}

export interface ImpactDecision {
  changedFiles: string[];
  affectedContracts: string[];
  escalation: 'L0' | 'L1' | 'L2' | 'L3';
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

const DEFAULT_RULES: ImpactRule[] = [
  { pattern: 'package-lock.json', contracts: ['CI-TOOLCHAIN-001'], escalateTo: 'L2', reason: 'dependency identity changed' },
  { pattern: '.nvmrc', contracts: ['CI-TOOLCHAIN-001'], escalateTo: 'L2', reason: 'runtime identity changed' },
  { pattern: 'package.json', contracts: ['CI-TOOLCHAIN-001', 'CI-CONFIG-001'], escalateTo: 'L2', reason: 'package configuration changed' },
  { pattern: 'scripts/ci/core/**', contracts: ['CI-DECISION-001', 'CI-CONFIG-001'], escalateTo: 'L2', reason: 'CI engine core changed' },
  { pattern: 'scripts/ci/contracts/**', contracts: ['CI-CONFIG-001'], escalateTo: 'L2', reason: 'CI contract configuration changed' },
  { pattern: 'scripts/ci/impact/**', contracts: ['CI-CONFIG-001'], escalateTo: 'L2', reason: 'impact engine changed' },
  { pattern: '.github/workflows/**', contracts: ['CI-CONFIG-001', 'CI-TOOLCHAIN-001'], escalateTo: 'L2', reason: 'workflow orchestration changed' },
];

function maxLevel(a: ImpactDecision['escalation'], b: ImpactDecision['escalation']): ImpactDecision['escalation'] {
  const rank = { L0: 0, L1: 1, L2: 2, L3: 3 } as const;
  return rank[b] > rank[a] ? b : a;
}

export function calculateImpact(changedFiles: readonly string[], contracts: readonly CiContract[], rules = DEFAULT_RULES): ImpactDecision {
  const ids = new Set(contracts.map((contract) => contract.id));
  const affected = new Set<string>();
  const reasons = new Set<string>();
  let escalation: ImpactDecision['escalation'] = 'L0';
  let conservative = false;

  for (const file of changedFiles) {
    const fileRules = rules.filter((rule) => matches(file, rule.pattern));
    if (fileRules.length === 0) {
      conservative = true;
      escalation = maxLevel(escalation, 'L3');
      reasons.add(`unmapped file: ${file}; conservative full escalation`);
      for (const contract of contracts) affected.add(contract.id);
      continue;
    }
    for (const rule of fileRules) {
      reasons.add(rule.reason);
      if (rule.escalateTo) escalation = maxLevel(escalation, rule.escalateTo);
      for (const id of rule.contracts) {
        if (!ids.has(id)) {
          conservative = true;
          escalation = maxLevel(escalation, 'L3');
          reasons.add(`rule references unknown contract: ${id}`);
          for (const contract of contracts) affected.add(contract.id);
        } else affected.add(id);
      }
    }
  }

  if (changedFiles.length === 0) return { changedFiles: [], affectedContracts: [], escalation: 'L0', reasons: ['no changed files'], conservative: false };
  return { changedFiles: [...changedFiles], affectedContracts: [...affected].sort(), escalation, reasons: [...reasons].sort(), conservative };
}
