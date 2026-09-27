import { existsSync, readFileSync } from "node:fs";

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
  const packageKey = `node_modules/${entry}`;
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

console.log("ARCHITECTURE_BOUNDARY_GATE=PASS");
