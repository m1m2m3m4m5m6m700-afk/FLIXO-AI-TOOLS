import { existsSync } from 'node:fs';
import { extname, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const isPathLike = (specifier) => specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');

function withTsExtension(url) {
  if (extname(fileURLToPath(url))) return url;
  const candidate = `${fileURLToPath(url)}.ts`;
  return existsSync(candidate) ? pathToFileURL(candidate).href : url;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const target = join(SRC, specifier.slice(2));
    return nextResolve(withTsExtension(pathToFileURL(target).href), context);
  }

  if (isPathLike(specifier) && !specifier.startsWith('file://')) {
    try {
      const resolved = new URL(specifier, context.parentURL);
      const resolvedWithTs = withTsExtension(resolved.href);
      return nextResolve(resolvedWithTs, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier, context);
}
