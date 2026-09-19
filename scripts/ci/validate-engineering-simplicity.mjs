import { readFile } from "node:fs/promises";
import process from "node:process";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const required = {
  ci: "npm run check && npm run test:unit && npm run test:e2e",
  "ci:target": "npm run verify:fast",
  "ci:repair": "npm run test:auto-repair && npm run validate:auto-repair-memory",
  "ci:certify": "npm run verify && npm run test:e2e && npm run verify:ci-cd-trust",
  release: "npm run ci:certify",
  "engineering:check": "node scripts/ci/validate-engineering-simplicity.mjs",
};

const failures = [];
for (const [name, command] of Object.entries(required)) {
  if (pkg.scripts?.[name] !== command) failures.push(`script ${name} does not match the canonical facade`);
}

if ("verify:contracts" in (pkg.scripts ?? {})) {
  failures.push("legacy duplicate facade command remains: verify:contracts");
}

const scripts = Object.keys(pkg.scripts ?? {});
const forbiddenPublicPatterns = [/^ci:(?!target$|repair$|certify$)/, /^release:/];
for (const name of scripts) {
  if (forbiddenPublicPatterns.some((pattern) => pattern.test(name))) {
    failures.push(`unexpected CI facade command: ${name}`);
  }
}

const taskFile = "المهام.md";
try {
  await readFile(taskFile, "utf8");
} catch {
  failures.push(`canonical task ledger missing: ${taskFile}`);
}

try {
  await readFile("docs/ENGINEERING-SIMPLIFICATION.md", "utf8");
} catch {
  failures.push("engineering simplification contract missing");
}

try {
  await readFile("scripts/ci/validate-certification-graph.mjs", "utf8");
  failures.push("dead compatibility alias remains: validate-certification-graph.mjs");
} catch {
  // Expected: the historical alias has been removed after caller proof.
}

if (failures.length) {
  console.error("ENGINEERING_SIMPLICITY_FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ENGINEERING_SIMPLICITY_GREEN");
console.log(`public facade: ${Object.keys(required).join(", ")}`);
