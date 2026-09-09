import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/image-core/types.ts",
  "src/image-core/document.ts",
  "src/image-core/history.ts",
  "src/image-core/render.ts",
  "src/image-core/index.ts",
];

const failures = [];
for (const file of required) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) failures.push(`missing ${file}`);
}

const history = fs.readFileSync(path.join(root, "src/image-core/history.ts"), "utf8");
for (const marker of ["execute(", "undo(", "redo(", "ImageCommand"]) {
  if (!history.includes(marker)) failures.push(`history missing ${marker}`);
}
if (history.includes("ImageData")) failures.push("history must remain command-based and not require full-raster snapshots");

const types = fs.readFileSync(path.join(root, "src/image-core/types.ts"), "utf8");
for (const marker of ["ImageDocument", "ImageLayer", "ImageMask", "ImageSelection", "ImageCommand", "ImageRenderer"]) {
  if (!types.includes(marker)) failures.push(`types missing ${marker}`);
}

if (failures.length) {
  console.error(JSON.stringify({ schemaVersion: 1, status: "FAIL", rcaId: "RC-IMAGE-CORE-FOUNDATION-001", failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  schemaVersion: 1,
  status: "PASS",
  rcaId: "RC-IMAGE-CORE-FOUNDATION-001",
  foundation: "document+layers+masks+selections+command-history+renderer",
  failures: [],
}, null, 2));
