import { spawnSync } from "node:child_process";

const root = process.cwd();
const env = {
  ...process.env,
  FLIXO_GENERATED_OUTPUT_DIR: "dist",
};

const commands = [
  ["scripts/generate-robots.mjs"],
  [
    "--import=./scripts/register-node-resolver.mjs",
    "--experimental-strip-types",
    "scripts/generate-sitemap.mjs",
  ],
  [
    "--import=./scripts/register-node-resolver.mjs",
    "--experimental-strip-types",
    "scripts/generate-static-route-entries.mjs",
  ],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Generated build artifacts into dist/ using a cross-platform Node wrapper.");
