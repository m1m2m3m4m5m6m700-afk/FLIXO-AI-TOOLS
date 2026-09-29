import { existsSync, statSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  throw new Error('TEST_FILE_GUARD_NO_FILES');
}

const missing = files.filter((file) => !existsSync(file) || !statSync(file).isFile());
if (missing.length > 0) {
  throw new Error(`TEST_FILE_GUARD_MISSING=${missing.join(',')}`);
}

console.log(`TEST_FILE_GUARD_OK=${files.length}`);
