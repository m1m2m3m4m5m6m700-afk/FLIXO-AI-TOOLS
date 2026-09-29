import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "packages/contracts";
const forbidden = ["apps/", "src/"];
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|mjs)$/u.test(path)) {
      const source = readFileSync(path, "utf8");
      for (const prefix of forbidden) {
        if (source.includes(prefix)) violations.push(path + " -> " + prefix);
      }
    }
  }
}

walk(root);
if (violations.length) {
  console.error("CONTRACT_BOUNDARY_GATE=FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log("CONTRACT_BOUNDARY_GATE=PASS");
