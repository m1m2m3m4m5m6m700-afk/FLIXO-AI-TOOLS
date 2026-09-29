import { spawnSync } from "node:child_process";

const root = process.cwd();
const commands = [
  ["type-check", "npm", ["run", "type-check", "--prefix", "apps/agent-editor"]],
  ["build", "npm", ["run", "build", "--prefix", "apps/agent-editor"]],
];

for (const [name, command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`Agent Editor gate failed: ${name}`);
    process.exit(result.status ?? 1);
  }
}

console.log("AGENT_EDITOR_GATE=PASS");
