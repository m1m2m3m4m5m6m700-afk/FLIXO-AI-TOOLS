import { createHash } from 'node:crypto';

export type ExecutionIdentity = Readonly<{ executionId: string; idempotencyKey: string; inputIdentity: string }>;

export function createExecutionIdentity(idempotencyKey: string, inputDescriptor: string): ExecutionIdentity {
  const inputIdentity = createHash('sha256').update(inputDescriptor, 'utf8').digest('hex');
  const executionId = createHash('sha256').update(idempotencyKey + ':' + inputIdentity, 'utf8').digest('hex');
  return Object.freeze({ executionId, idempotencyKey, inputIdentity });
}

export function sameExecution(left: ExecutionIdentity, right: ExecutionIdentity): boolean {
  return left.executionId === right.executionId && left.inputIdentity === right.inputIdentity;
}
