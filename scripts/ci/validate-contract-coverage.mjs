import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const expected = process.env.FLIXO_SOURCE_SHA || process.env.EXPECTED_HEAD_SHA;
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (expected && expected !== actual) {
  console.error(`Contract coverage failed: ${actual} != ${expected}`);
  process.exit(1);
}

const read = (path) => readFileSync(path, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};
const failures = [];

const requiredContracts = [
  ['G1 baseline', 'validate:baseline'],
  ['Registry', 'validate:tool-registry'],
  ['Manifest', 'validate:tool-manifest'],
  ['Router/Registry parity', 'validate:router-registry'],
  ['Canonical locale', 'validate:canonical-locale-surface'],
  ['i18n', 'validate:i18n'],
  ['SEO', 'validate:seo'],
  ['SEO manifest', 'validate:seo-manifest'],
  ['Unit contract', 'test:unit'],
];
for (const [name, script] of requiredContracts) if (!scripts[script]) failures.push(`${name} contract endpoint missing: ${script}`);

const verifyContracts = scripts['verify:contracts'] ?? '';
for (const script of ['test:unit', 'test:tool-localization', 'test-release-evidence', 'test-file-safety', 'test-output-integrity', 'test-svg-integrity', 'validate:baseline', 'validate:tool-registry', 'validate:tool-manifest', 'validate:router-registry', 'validate:i18n', 'validate:canonical-locale-surface', 'validate:seo', 'validate:seo-manifest']) {
  if (!verifyContracts.includes(script)) failures.push(`verify:contracts is missing required evidence endpoint: ${script}`);
}

const check = scripts.check ?? '';
for (const script of ['typecheck', 'lint', 'validate:baseline', 'validate:tool-registry', 'validate:tool-manifest', 'validate:router-registry', 'validate:i18n', 'validate:canonical-locale-surface', 'validate:seo', 'validate:seo-manifest', 'build']) {
  if (!check.includes(script)) failures.push(`check is missing required gate: ${script}`);
}

const files = {
  registry: read('src/config/tools.ts') + read('src/config/tool-definitions/image.ts'),
  routes: read('src/routes/route-tree.ts'),
  seo: read('src/lib/seo/tool-seo.ts'),
  output: read('src/lib/contracts/tool-output.ts'),
  g2: read('src/lib/contracts/file-safety.ts'),
  g3: read('src/lib/contracts/output-integrity.ts'),
};
if (!/getReadyToolConfigs\(\)/u.test(files.registry)) failures.push('Registry does not expose ready-tool derivation.');
if (!/localizedToolRoute/u.test(files.routes)) failures.push('Route graph is missing canonical localized tool route.');
if (!/getLocalizedToolUrl/u.test(files.seo)) failures.push('SEO does not consume canonical route resolver.');
if (!/['"]image['"].*['"]svg['"].*['"]zip['"].*['"]text['"].*['"]json['"]/su.test(files.output)) failures.push('Tool output universe is not explicitly Image/SVG/ZIP/Text/JSON.');
if (!/MAGIC_BYTE_SIGNATURES|magicBytes/u.test(files.g2)) failures.push('G2 does not enforce magic-byte validation.');
if (!/validateArchiveEntries|detectZipBombRisk/u.test(files.g2)) failures.push('G2 archive safety contract missing.');
if (!/sha256|SHA-256|digest/u.test(files.g3)) failures.push('G3 artifact digest/integrity contract missing.');

const workflow = read('.github/workflows/matrix-ci-recovery.yml');
for (const script of ['validate-agent-coordination-protocol.mjs', 'validate-agent-sessions.mjs', 'validate-protocol-cooperation.mjs', 'validate-contract-coverage.mjs', 'validate-architecture.mjs']) {
  if (!workflow.includes(script)) failures.push(`Matrix Recovery does not execute ${script}.`);
}
if (/continue-on-error:\s*true/u.test(workflow)) failures.push('Matrix Recovery suppresses a required failure.');

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Contract coverage PASS for exact SHA ${actual}: registry, routing, SEO, output, G2, G3, unit, and CI governance endpoints are wired into verification.`);
