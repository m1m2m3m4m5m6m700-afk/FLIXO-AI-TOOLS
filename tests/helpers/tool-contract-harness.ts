export type HarnessStage = 'INPUT' | 'EXECUTE' | 'OUTPUT' | 'ERROR' | 'A11Y';

export type HarnessResult<TOutput = unknown> = Readonly<{
  stage: HarnessStage;
  ok: boolean;
  output?: TOutput;
  error?: string;
}>;

export type ToolContractHarness<Input, Output> = Readonly<{
  input: Input;
  execute: (input: Input) => Promise<Output>;
  verifyOutput: (output: Output) => void | Promise<void>;
  verifyA11y?: (output: Output) => void | Promise<void>;
  expectError?: (input: Input) => void | Promise<void>;
}>;

export async function runToolContractHarness<Input, Output>(
  contract: ToolContractHarness<Input, Output>,
): Promise<readonly HarnessResult<Output>[]> {
  const results: HarnessResult<Output>[] = [];
  results.push({ stage: 'INPUT', ok: contract.input !== undefined });
  if (contract.input === undefined) return Object.freeze(results);

  try {
    const output = await contract.execute(contract.input);
    results.push({ stage: 'EXECUTE', ok: true, output });
    await contract.verifyOutput(output);
    results.push({ stage: 'OUTPUT', ok: true, output });
    if (contract.verifyA11y) {
      await contract.verifyA11y(output);
      results.push({ stage: 'A11Y', ok: true, output });
    }
  } catch (error) {
    results.push({ stage: 'EXECUTE', ok: false, error: String(error instanceof Error ? error.message : error) });
  }

  if (contract.expectError) {
    try {
      await contract.expectError(contract.input);
      results.push({ stage: 'ERROR', ok: true });
    } catch (error) {
      results.push({ stage: 'ERROR', ok: false, error: String(error instanceof Error ? error.message : error) });
    }
  }
  return Object.freeze(results);
}

export function assertHarnessPass(results: readonly HarnessResult[]): void {
  const failed = results.filter((result) => result.ok !== true);
  if (failed.length) throw new Error(`CONTRACT_HARNESS_FAILED=${failed.map((result) => result.stage).join(',')}`);
}
