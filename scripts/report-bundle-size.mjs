import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const assetsDir = 'dist/assets';
const reportDir = 'diagnostics';
const reportPath = join(reportDir, 'bundle-size.json');

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

if (!statSync('dist', { throwIfNoEntry: false }) || !statSync(assetsDir, { throwIfNoEntry: false })) {
  throw new Error(`Build output not found: ${assetsDir}`);
}

const files = walk(assetsDir)
  .map((path) => ({
    file: relative('dist', path).replaceAll('\\', '/'),
    bytes: statSync(path).size,
  }))
  .sort((a, b) => b.bytes - a.bytes);

const javascript = files.filter((entry) => /\.m?js$/i.test(entry.file));
const css = files.filter((entry) => /\.css$/i.test(entry.file));
const totalBytes = files.reduce((sum, entry) => sum + entry.bytes, 0);
const totalJavaScriptBytes = javascript.reduce((sum, entry) => sum + entry.bytes, 0);
const totalCssBytes = css.reduce((sum, entry) => sum + entry.bytes, 0);

const report = {
  generatedAt: new Date().toISOString(),
  assets: files,
  totals: {
    assets: files.length,
    bytes: totalBytes,
    javascriptBytes: totalJavaScriptBytes,
    cssBytes: totalCssBytes,
  },
  topJavaScript: javascript.slice(0, 15),
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log('Bundle size inventory');
console.log(`Assets: ${files.length}`);
console.log(`Total: ${(totalBytes / 1024).toFixed(1)} KiB`);
console.log(`JavaScript: ${(totalJavaScriptBytes / 1024).toFixed(1)} KiB`);
console.log(`CSS: ${(totalCssBytes / 1024).toFixed(1)} KiB`);
console.log('Top JavaScript assets:');
for (const entry of javascript.slice(0, 10)) {
  console.log(`- ${entry.file}: ${(entry.bytes / 1024).toFixed(1)} KiB`);
}
