import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".github", "agents");
const required = ["flixo-qa-agent.md", "flixo-i18n-agent.md", "flixo-maintainer-agent.md"];
const files = new Set(readdirSync(dir));
const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) throw new Error(`Missing agent profiles: ${missing.join(", ")}`);
for (const file of required) {
  const content = readFileSync(join(dir, file), "utf8");
  if (!content.startsWith("---\n")) throw new Error(`${file}: invalid frontmatter`);
}
console.log(`AGENT_PROFILES_OK=${required.length}`);
