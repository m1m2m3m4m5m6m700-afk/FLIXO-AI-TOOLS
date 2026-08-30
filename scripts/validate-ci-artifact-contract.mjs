import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const fail = (message) => {
  console.error(`CI artifact contract failed: ${message}`);
  process.exit(1);
};

if (!/run:\s*npm run build\s*\n/.test(workflow)) fail('canonical build owner must run npm run build');
if (!/name:\s*flixo-build-\$\{\{ github\.sha \}\}/.test(workflow)) fail('build artifact must be immutable and SHA-addressed');
if (!/actions\/upload-artifact@v6/.test(workflow)) fail('build artifact upload must use the pinned artifact action');
if (!/name:\s*Download immutable build artifact/.test(workflow)) fail('artifact consumers must download the build artifact');
if (!/FLIXO_BUILD_ARTIFACT:\s*['"]true['"]/.test(workflow)) fail('artifact-consuming gates must explicitly assert artifact mode');
if (!/name:\s*Evidence Ledger/.test(workflow)) fail('Evidence Ledger job is missing');
if (!/scripts\/ci\/write-evidence-ledger\.mjs/.test(workflow)) fail('Evidence Ledger writer is not wired');
if (!/name:\s*Canonical Verification Gate[\s\S]*?needs:\s*\[evidence-ledger\]/.test(workflow)) fail('Canonical must consume the Evidence Ledger');
if (/s3-static-gate:[\s\S]*?run:\s*npm run build/.test(workflow)) fail('S3 must not rebuild the application');
if (/production-seo:[\s\S]*?run:\s*npm run build/.test(workflow)) fail('PR production SEO gate must not rebuild the application');

console.log('CI artifact contract passed: one canonical build, SHA-addressed immutable artifact, artifact consumers, and Evidence Ledger are enforced.');
