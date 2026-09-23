#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY_PATH = path.join(ROOT, 'docs/agents/ADVERSARIAL-BOT-COMMANDS.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

const args = new Map();
for (const token of process.argv.slice(2)) {
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  args.set(token.slice(2, eq >= 0 ? eq : undefined), eq >= 0 ? token.slice(eq + 1) : null);
}
const command = process.argv[2] ?? 'list';

export function validateAdversarialBotCommandRegistry(value = registry) {
  const failures = [];
  if (value?.protocol !== 'FLIXO-ADVERSARIAL-BOT-COMMAND-REGISTRY-v1') failures.push('PROTOCOL_INVALID');
  if (value?.canonical !== true) failures.push('CANONICAL_REQUIRED');
  if (value?.authority !== 'COMMAND_ROUTER_ONLY') failures.push('COMMAND_ROUTER_AUTHORITY_INVALID');
  if (value?.branchPolicy?.workingBranch !== 'execution') failures.push('WORKING_BRANCH_INVALID');
  if (value?.branchPolicy?.productionBranch !== 'main') failures.push('PRODUCTION_BRANCH_INVALID');
  if (value?.branchPolicy?.thirdBranchAllowed !== false) failures.push('THIRD_BRANCH_FORBIDDEN_RULE_MISSING');
  if (value?.branchPolicy?.noMainMutation !== true) failures.push('NO_MAIN_MUTATION_RULE_MISSING');
  if (value?.identity?.exactShaRequired !== true) failures.push('EXACT_SHA_REQUIRED');
  if (value?.acceptance?.primaryProofRequired !== true) failures.push('PRIMARY_PROOF_REQUIRED');
  if (value?.acceptance?.adversarialFalsificationRequired !== true) failures.push('ADVERSARIAL_PROOF_REQUIRED');
  if (value?.acceptance?.validCounterexampleBlocksAcceptance !== true) failures.push('COUNTEREXAMPLE_BLOCKING_REQUIRED');

  const bots = value?.bots;
  if (!bots || typeof bots !== 'object') failures.push('BOTS_MISSING');
  for (const [botId, bot] of Object.entries(bots ?? {})) {
    if (!bot?.agentId) failures.push(`BOT_AGENT_MISSING=${botId}`);
    if (!bot?.role) failures.push(`BOT_ROLE_MISSING=${botId}`);
    if (!bot?.commands || typeof bot.commands !== 'object' || !Object.keys(bot.commands).length) {
      failures.push(`BOT_COMMANDS_MISSING=${botId}`);
      continue;
    }
    for (const [commandId, spec] of Object.entries(bot.commands)) {
      if (!spec?.entry) failures.push(`COMMAND_ENTRY_MISSING=${botId}:${commandId}`);
      if (!spec?.operation) failures.push(`COMMAND_OPERATION_MISSING=${botId}:${commandId}`);
      if (spec?.mutation === true && bot.mutationAuthority === 'NONE') {
        failures.push(`READ_ONLY_BOT_MUTATION_COMMAND=${botId}:${commandId}`);
      }
    }
  }
  if (!Array.isArray(value?.commonCommandRules) || value.commonCommandRules.length < 8) failures.push('COMMON_COMMAND_RULES_INCOMPLETE');
  return Object.freeze({ ok: failures.length === 0, failures, botCount: Object.keys(bots ?? {}).length });
}

export function resolveAdversarialCommand({ botId, commandId, value = registry } = {}) {
  const bot = value?.bots?.[botId];
  if (!bot) throw new Error('ADVERSARIAL_BOT_NOT_REGISTERED=' + botId);
  const spec = bot.commands?.[commandId];
  if (!spec) throw new Error('ADVERSARIAL_COMMAND_NOT_REGISTERED=' + botId + ':' + commandId);
  return Object.freeze({
    botId,
    agentId: bot.agentId,
    role: bot.role,
    mutationAuthority: bot.mutationAuthority,
    commandId,
    command: spec,
    registryProtocol: value.protocol,
  });
}

function print(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

const validation = validateAdversarialBotCommandRegistry();
if (!validation.ok) {
  print(validation);
  process.exitCode = 1;
} else if (command === 'validate') {
  print({ status: 'PASS', ...validation, path: REGISTRY_PATH });
} else if (command === 'list') {
  const bots = Object.entries(registry.bots).map(([botId, bot]) => ({
    botId,
    agentId: bot.agentId,
    role: bot.role,
    commands: Object.keys(bot.commands ?? {}),
  }));
  print({ protocol: registry.protocol, bots });
} else if (command === 'get') {
  const botId = String(args.get('bot') ?? '');
  const commandId = String(args.get('command') ?? '');
  print(resolveAdversarialCommand({ botId, commandId }));
} else {
  throw new Error('Usage: adversarial-bot-commands.mjs validate|list|get --bot=<id> --command=<id>');
}
