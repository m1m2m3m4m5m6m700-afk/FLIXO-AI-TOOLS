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
    canDispatchTo: ['WORKER_A', 'WORKER_B'] as CouncilAccountId[],
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

export const COUNCIL_CELL_NAME = 'الخلية' as const;
export const RAW_CELL_BOT_COUNT = 50 as const;

export type RawCellBotId = `CELL-${number}`;

export type RawCellBotDefinition = {
  botId: RawCellBotId;
  cellName: typeof COUNCIL_CELL_NAME;
  mode: 'RAW';
  state: 'UNPROVISIONED';
  specialization: null;
  runtimeAccountId: null;
  mutationAuthority: false;
  certificationAuthority: false;
};

function buildRawCellBots(): RawCellBotDefinition[] {
  return Array.from({ length: RAW_CELL_BOT_COUNT }, (_, index) => Object.freeze({
    botId: `CELL-${String(index + 1).padStart(3, '0')}` as RawCellBotId,
    cellName: COUNCIL_CELL_NAME,
    mode: 'RAW' as const,
    state: 'UNPROVISIONED' as const,
    specialization: null,
    runtimeAccountId: null,
    mutationAuthority: false,
    certificationAuthority: false,
  }));
}

/**
 * Logical execution capacity only. These slots are not external runtime
 * identities, do not create credentials/endpoints, and inherit all authority
 * from the existing Control Plane/runtime account when explicitly provisioned.
 */
export const RAW_CELL_BOTS: ReadonlyArray<RawCellBotDefinition> = Object.freeze(buildRawCellBots());

export function getRawCellBot(botId: string): RawCellBotDefinition {
  const bot = RAW_CELL_BOTS.find((candidate) => candidate.botId === botId);
  if (!bot) throw new Error('COUNCIL_CELL_BOT_UNKNOWN=' + botId);
  return bot;
}

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


export const ACTION_AGENT_TRIAD = Object.freeze({
 CHIEF: Object.freeze({ profileId:'ACTION_COMMANDER_V1', role:'ACTION_COMMANDER', cognitionTier:'ADVANCED', mutationMode:'NONE', certificationAuthority:false }),
 WORKER_A: Object.freeze({ profileId:'ACTION_FRONTIER_REPAIR_V2', role:'PRIMARY_ACTION_REPAIR', cognitionTier:'FRONTIER_SPECIALIST', modelProfile:'FRONTIER_CODING_REASONING', reasoningEffort:'MAXIMUM', mutationMode:'DELEGATED_REPAIR_ONLY', certificationAuthority:false }),
 WORKER_B: Object.freeze({ profileId:'ACTION_FRONTIER_ADVERSARIAL_V2', role:'ADVERSARIAL_ACTION_REPAIR', cognitionTier:'FRONTIER_ADVERSARIAL', modelProfile:'FRONTIER_ADVERSARIAL_REASONING', reasoningEffort:'MAXIMUM', mutationMode:'DELEGATED_REPAIR_ONLY', certificationAuthority:false }),
});
