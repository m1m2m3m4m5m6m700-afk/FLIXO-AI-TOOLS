export type CouncilAccountId = 'CHIEF' | 'WORKER_A' | 'WORKER_B';
export type CouncilRole = CouncilAccountId;

export type CouncilAccountDefinition = {
  accountId: CouncilAccountId;
  role: CouncilRole;
  transport: 'POLL' | 'HYBRID';
  tokenEnv: string;
  endpointEnv?: string;
  mutationAuthority: boolean;
  certificationAuthority: boolean;
  canDispatchTo: CouncilAccountId[];
  fallbackAccountId: CouncilAccountId;
};

export const COUNCIL_ACCOUNTS: Readonly<Record<CouncilAccountId, CouncilAccountDefinition>> = Object.freeze({
  CHIEF: Object.freeze({
    accountId: 'CHIEF',
    role: 'CHIEF',
    transport: 'POLL',
    tokenEnv: 'COUNCIL_CHIEF_TOKEN',
    mutationAuthority: false,
    certificationAuthority: false,
    canDispatchTo: ['WORKER_A', 'WORKER_B'],
    fallbackAccountId: 'CHIEF',
  }),
  WORKER_A: Object.freeze({
    accountId: 'WORKER_A',
    role: 'WORKER_A',
    transport: 'HYBRID',
    tokenEnv: 'COUNCIL_WORKER_A_TOKEN',
    endpointEnv: 'COUNCIL_WORKER_A_WAKE_ENDPOINT',
    mutationAuthority: true,
    certificationAuthority: false,
    canDispatchTo: [],
    fallbackAccountId: 'WORKER_B',
  }),
  WORKER_B: Object.freeze({
    accountId: 'WORKER_B',
    role: 'WORKER_B',
    transport: 'HYBRID',
    tokenEnv: 'COUNCIL_WORKER_B_TOKEN',
    endpointEnv: 'COUNCIL_WORKER_B_WAKE_ENDPOINT',
    mutationAuthority: true,
    certificationAuthority: false,
    canDispatchTo: [],
    fallbackAccountId: 'WORKER_A',
  }),
});

export function getCouncilAccount(accountId: string): CouncilAccountDefinition {
  if (!(accountId in COUNCIL_ACCOUNTS)) throw new Error('COUNCIL_ACCOUNT_UNKNOWN=' + accountId);
  return COUNCIL_ACCOUNTS[accountId as CouncilAccountId];
}

export function assertCouncilDispatchAuthorization(requester: CouncilAccountId | 'SYSTEM', target: CouncilAccountId, fallback: CouncilAccountId) {
  if (requester === 'SYSTEM') {
    if (target !== 'CHIEF' || fallback !== 'CHIEF') throw new Error('COUNCIL_SYSTEM_DISPATCH_ONLY_CHIEF');
    return;
  }
  if (requester !== 'CHIEF') throw new Error('COUNCIL_WORKER_DISPATCH_FORBIDDEN');
  if (!getCouncilAccount('CHIEF').canDispatchTo.includes(target)) throw new Error('COUNCIL_TARGET_ACCOUNT_FORBIDDEN');
  if (fallback !== getCouncilAccount(target).fallbackAccountId) throw new Error('COUNCIL_FALLBACK_ACCOUNT_INVALID');
}

export function assertExactSha(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) throw new Error('COUNCIL_EXACT_SHA_INVALID');
}
