import { existsSync, readFileSync } from 'node:fs';
import { extname, dirname, join, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const isPathLike = (specifier) => specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');

function withTsExtension(url) {
  const filePath = fileURLToPath(url);
  if (extname(filePath)) return url;

  const fileCandidate = `${filePath}.ts`;
  if (existsSync(fileCandidate)) return pathToFileURL(fileCandidate).href;

  const tsxFileCandidate = `${filePath}.tsx`;
  if (existsSync(tsxFileCandidate)) return pathToFileURL(tsxFileCandidate).href;

  const indexCandidate = join(filePath, 'index.ts');
  if (existsSync(indexCandidate)) return pathToFileURL(indexCandidate).href;

  const indexTsxCandidate = join(filePath, 'index.tsx');
  if (existsSync(indexTsxCandidate)) return pathToFileURL(indexTsxCandidate).href;

  return url;
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

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx')) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        sourceMap: true,
      },
      fileName: filename,
      reportDiagnostics: true,
    });

    const diagnostics = transpiled.diagnostics ?? [];
    if (diagnostics.length > 0) {
      const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => ROOT,
        getNewLine: () => '\n',
      });
      throw new Error(`TSX transform failed for ${filename}\n${message}`);
    }

    return {
      format: 'module',
      source: `${transpiled.outputText}\n//# sourceURL=${pathToFileURL(filename).href}`,
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
