import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('tests/fixtures/g3');
await fs.mkdir(root, { recursive: true });
const files = {
  'valid.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  'valid.jpg': Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300', 'hex'),
  'valid.webp': Buffer.from('52494646', 'hex'),
  'valid.gif': Buffer.from('47494638396101000100800000ffffff00000021f904010a0001002c00000000010001000002024401003b', 'hex'),
  'valid.bmp': Buffer.from('424d3e000000000000003600000028000000010000000100000001001800000000000800000000000000000000000000000000000000000000000000000000000000', 'hex'),
  'valid.svg': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>'),
  'invalid-mime.bin': Buffer.from('not-an-image'),
  'invalid-signature.png': Buffer.from('not-a-real-png'),
  'invalid-extension.jpg': Buffer.from('not-a-real-jpeg'),
  'traversal.txt': Buffer.from('../evil'),
  'empty.bin': Buffer.alloc(0),
  'oversized.bin': Buffer.alloc(1025, 0x41),
  'malformed.json': Buffer.from('{"ok":}'),
};
const metadata = [];
for (const [name, bytes] of Object.entries(files)) {
  const filePath = path.join(root, name);
  await fs.writeFile(filePath, bytes);
  metadata.push({ name, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), magicBytes: bytes.subarray(0, 16).toString('hex') });
}
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, deterministic: true, fixtures: metadata }, null, 2) + '\n');
console.log(JSON.stringify({ fixtureCount: metadata.length, fixtures: metadata }, null, 2));
