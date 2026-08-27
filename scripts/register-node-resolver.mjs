import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(join(ROOT, 'scripts/node-resolver-loader.mjs')));
