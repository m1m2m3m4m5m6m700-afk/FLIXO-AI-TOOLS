import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const workspace = pkg.workspaces;

const requiredWorkspaces = [
  "apps/agent-editor",
  "packages/contracts",
  "packages/agent-runtime",
];

if (!Array.isArray(workspace) || !requiredWorkspaces.every((entry) => workspace.includes(entry))) {
  console.error("Architecture gate: canonical npm workspaces are incomplete.");
  process.exit(1);
}

if (!existsSync("package-lock.json") || lock.lockfileVersion !== 3) {
  console.error("Architecture gate: canonical npm lockfile is missing or invalid.");
  process.exit(1);
}

for (const entry of requiredWorkspaces) {
  const packageKey = entry;
  if (!lock.packages?.[packageKey]) {
    console.error(`Architecture gate: workspace is missing from lockfile: ${entry}`);
    process.exit(1);
  }
}

if (!pkg.scripts["test:agent-editor"] || !pkg.scripts["build:agent-editor"]) {
  console.error("Architecture gate: agent-editor workspace scripts are missing.");
  process.exit(1);
}

if (!pkg.scripts["typecheck:contracts"] || !pkg.scripts["typecheck:agent-runtime"]) {
  console.error("Architecture gate: canonical package typechecks are missing.");
  process.exit(1);
}

const migratedLegacyImports = [
  "@/lib/agent/agent-profile",
  "@/lib/agent/agent-discovery",
  "@/lib/agent/task-state",
  "@/lib/agent/agent-task-manager",
  "@/lib/agent/reasoning",
  "@/lib/agent/task-decomposer",
  "@/lib/agent/evaluation",
  "@/lib/agent/execution-budget",
  "@/lib/agent/goal-controller",
  "@/lib/agent/stuck-detector",
  "@/lib/agent/universal/math-engine",
];

const sourceRoots = ["src", "apps", "packages"];
const importViolations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path)) {
      const source = readFileSync(path, "utf8");
      for (const legacyImport of migratedLegacyImports) {
        if (source.includes(legacyImport)) importViolations.push(path + " -> " + legacyImport);
      }
    }
  }
}

for (const root of sourceRoots) {
  if (existsSync(root)) walk(root);
}

if (importViolations.length) {
  console.error("Architecture gate: migrated Agent runtime compatibility imports are forbidden.");
  for (const violation of importViolations) console.error(violation);
  process.exit(1);
}

console.log("ARCHITECTURE_BOUNDARY_GATE=PASS");
