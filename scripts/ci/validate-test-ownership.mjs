import fs from 'node:fs';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const packageJson = readJson('package.json');
const registry = readJson('scripts/ci/test-ownership-map.json');
const impactMap = readJson('scripts/ci/test-impact-map.json');
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const repair = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const errors = [];

const entries = Object.entries(registry.criticalCommands ?? {});
const owners = new Map();
const signatures = new Map();

const commandKey = (command) => JSON.stringify(command);
const npmScript = (command) => command?.[0] === 'npm' && command?.[1] === 'run' ? command[2] : null;
const impactCommands = new Set(
  (impactMap.rules ?? []).flatMap((rule) => Array.isArray(rule.commands) ? rule.commands : []),
);

if (registry.version !== 1) errors.push(`REGISTRY_VERSION: expected 1, found ${registry.version}`);
if (!entries.length) errors.push('EMPTY_REGISTRY: no critical verification command is registered');

for (const [name, entry] of entries) {
  if (!entry || typeof entry !== 'object') {
    errors.push(`${name}: invalid registry entry`);
    continue;
  }
  const { command, owner, executionSurface, requiredConsumers, routing } = entry;
  if (!Array.isArray(command) || command.length < 2) errors.push(`${name}: invalid command`);
  if (!owner || !executionSurface || !Array.isArray(requiredConsumers) || !routing) errors.push(`${name}: incomplete ownership metadata`);
  if (owners.has(owner)) errors.push(`OWNER_COLLISION: ${owners.get(owner)} and ${name} share ${owner}`);
  else owners.set(owner, name);
  if (Array.isArray(command)) {
    const signature = commandKey(command);
    if (signatures.has(signature)) errors.push(`DUPLICATE_COMMAND_OWNER: ${signatures.get(signature)} and ${name}`);
    else signatures.set(signature, name);
  }
  const script = npmScript(command);
  if (script && typeof packageJson.scripts?.[script] !== 'string') errors.push(`${name}: missing package script ${script}`);
}

const required = {
  typecheck: ['npm', 'run', 'typecheck'],
  'test:static': ['npm', 'run', 'test:static'],
  'test:build': ['npm', 'run', 'test:build'],
};
for (const [name, command] of Object.entries(required)) {
  const entry = registry.criticalCommands?.[name];
  if (!entry) errors.push(`MISSING_CRITICAL_OWNER: ${name}`);
  else if (commandKey(entry.command) !== commandKey(command)) errors.push(`COMMAND_DRIFT: ${name}`);
}

const staticOwner = registry.criticalCommands?.['test:static'];
const buildOwner = registry.criticalCommands?.['test:build'];
const typecheckOwner = registry.criticalCommands?.typecheck;
if (!ci.includes('run: npm run test:static')) errors.push('CI_DRIFT: static gate no longer executes npm run test:static');
if (!ci.includes('run: npm run test:build')) errors.push('CI_DRIFT: build gate no longer executes npm run test:build');
if (!repair.includes('npm run test:static')) errors.push('REPAIR_DRIFT: auto-repair no longer verifies test:static');
if (!repair.includes('npm run test:build')) errors.push('REPAIR_DRIFT: auto-repair no longer verifies test:build');
if (!repair.includes('npm run typecheck')) errors.push('REPAIR_DRIFT: auto-repair no longer verifies typecheck');
if (staticOwner?.executionSurface !== 'static') errors.push('OWNER_DRIFT: test:static must be owned by static execution surface');
if (buildOwner?.executionSurface !== 'build') errors.push('OWNER_DRIFT: test:build must be owned by build execution surface');
if (typecheckOwner?.executionSurface !== 'static') errors.push('OWNER_DRIFT: typecheck must be owned by static execution surface');

const infrastructureCommands = new Set(['test:static', 'test:build']);
for (const [name, entry] of entries) {
  const command = entry.command?.join(' ');
  const script = npmScript(entry.command);
  if (script && !impactCommands.has(command) && !infrastructureCommands.has(script)) {
    errors.push(`IMPACT_ORPHAN: ${name} (${command}) is not represented in test-impact-map.json`);
  }
}

const result = {
  schema_version: 1,
  status: errors.length ? 'FAIL' : 'PASS',
  criticalCommandCount: entries.length,
  owners: Object.fromEntries(entries.map(([name, entry]) => [name, entry.owner])),
  impactRuleCount: (impactMap.rules ?? []).length,
  errors,
};
fs.mkdirSync('diagnostics/ci', { recursive: true });
fs.writeFileSync('diagnostics/ci/test-ownership-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
