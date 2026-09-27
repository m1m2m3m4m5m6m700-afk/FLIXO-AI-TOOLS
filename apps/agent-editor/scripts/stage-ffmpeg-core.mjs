import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(scriptDir, "../public/ffmpeg");
const resolvedCore = require.resolve("@ffmpeg/core");
const sourceDir = path.dirname(resolvedCore).endsWith(path.join("dist", "esm"))
  ? path.dirname(resolvedCore)
  : path.resolve(path.dirname(resolvedCore), "dist", "esm");

const requiredFiles = ["ffmpeg-core.js", "ffmpeg-core.wasm"];
const optionalFiles = ["ffmpeg-core.worker.js"];

await fs.mkdir(publicDir, { recursive: true });

for (const fileName of requiredFiles) {
  const source = path.join(sourceDir, fileName);
  const destination = path.join(publicDir, fileName);
  await fs.access(source);
  await fs.copyFile(source, destination);
}

for (const fileName of optionalFiles) {
  const source = path.join(sourceDir, fileName);
  const destination = path.join(publicDir, fileName);
  try {
    await fs.access(source);
    await fs.copyFile(source, destination);
  } catch {
    await fs.rm(destination, { force: true });
  }
}

console.log("[FLIXO] staged FFmpeg WASM core into " + publicDir);