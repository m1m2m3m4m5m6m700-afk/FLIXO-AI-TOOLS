import type { CiContract, ContractResult } from './types.ts';

export function indexContracts(contracts: readonly CiContract[]): Map<string, CiContract> {
  return new Map(contracts.map((contract) => [contract.id, contract]));
}

export function validateDependencyGraph(contracts: readonly CiContract[]): void {
  const byId = indexContracts(contracts);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  for (const contract of contracts) {
    if (visiting.has(contract.id)) throw new Error(`Dependency cycle at ${contract.id}`);
    const stack: string[] = [];
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error(`Dependency cycle: ${[...stack, id].join(' -> ')}`);
      if (visited.has(id)) return;
      const current = byId.get(id);
      if (!current) throw new Error(`Unknown dependency node: ${id}`);
      visiting.add(id);
      stack.push(id);
      for (const dependency of current.dependencies) visit(dependency);
      stack.pop();
      visiting.delete(id);
      visited.add(id);
    };
    visit(contract.id);
  }
}

export function topologicalOrder(contracts: readonly CiContract[]): string[] {
  validateDependencyGraph(contracts);
  const byId = indexContracts(contracts);
  const output: string[] = [];
  const emitted = new Set<string>();

  const visit = (id: string): void => {
    if (emitted.has(id)) return;
    const contract = byId.get(id);
    if (!contract) throw new Error(`Unknown contract: ${id}`);
    for (const dependency of [...contract.dependencies].sort()) visit(dependency);
    emitted.add(id);
    output.push(id);
  };

  for (const contract of [...contracts].sort((a, b) => a.id.localeCompare(b.id))) visit(contract.id);
  return output;
}

export function dependencyClosure(contractIds: readonly string[], contracts: readonly CiContract[]): string[] {
  const byId = indexContracts(contracts);
  const seen = new Set<string>();
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    const contract = byId.get(id);
    if (!contract) throw new Error(`Unknown contract: ${id}`);
    seen.add(id);
    for (const dependency of contract.dependencies) visit(dependency);
  };
  for (const id of contractIds) visit(id);
  return topologicalOrder([...seen].map((id) => byId.get(id)!));
}

export function blockedResults(results: readonly ContractResult[], contracts: readonly CiContract[]): ContractResult[] {
  const byId = indexContracts(contracts);
  const state = new Map(results.map((result) => [result.contract, result]));
  const ordered = topologicalOrder(contracts);

  for (const id of ordered) {
    const result = state.get(id);
    const contract = byId.get(id);
    if (!result || !contract || result.status === 'FAIL') continue;
    const blockedBy = contract.dependencies.filter((dependency) => {
      const dependencyResult = state.get(dependency);
      return dependencyResult?.status === 'FAIL' || dependencyResult?.status === 'BLOCKED';
    });
    if (blockedBy.length === 0 || result.status === 'BLOCKED') continue;
    state.set(id, {
      ...result,
      status: 'BLOCKED',
      blockedBy,
    });
  }

  return ordered.flatMap((id) => {
    const result = state.get(id);
    return result ? [result] : [];
  });
}
