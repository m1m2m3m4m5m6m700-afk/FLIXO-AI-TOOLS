import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const workspace = pkg.workspaces;

if (workspace) {
  console.error("Architecture gate: npm workspaces must not be declared until the root lockfile is regenerated.");
  process.exit(1);
}

if (!pkg.scripts["test:agent-editor"] || !pkg.scripts["build:agent-editor"]) {
  console.error("Architecture gate: agent-editor verification scripts are missing.");
  process.exit(1);
}

console.log("ARCHITECTURE_BOUNDARY_GATE=PASS");
