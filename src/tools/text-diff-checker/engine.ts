export type DiffKind = 'equal' | 'added' | 'removed';

export type DiffPart = { kind: DiffKind; value: string };

export type DiffResult = {
  parts: DiffPart[];
  added: number;
  removed: number;
  unchanged: number;
};

function tokenize(text: string, ignoreWhitespace: boolean): string[] {
  if (!ignoreWhitespace) return [...text];
  return text.replace(/\s+/gu, ' ').split('');
}

export function diffText(original: string, modified: string, ignoreWhitespace = false): DiffResult {
  const a = tokenize(original, ignoreWhitespace);
  const b = tokenize(modified, ignoreWhitespace);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const lcs = Array.from({ length: rows }, () => new Uint32Array(cols));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  const push = (kind: DiffKind, value: string) => {
    if (!value) return;
    const last = parts.at(-1);
    if (last?.kind === kind) last.value += value;
    else parts.push({ kind, value });
  };

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('equal', a[i]); i += 1; j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('removed', a[i]); i += 1;
    } else {
      push('added', b[j]); j += 1;
    }
  }
  while (i < a.length) { push('removed', a[i]); i += 1; }
  while (j < b.length) { push('added', b[j]); j += 1; }

  const count = (kind: DiffKind) => parts.filter((part) => part.kind === kind).reduce((sum, part) => sum + [...part.value].length, 0);
  return { parts, added: count('added'), removed: count('removed'), unchanged: count('equal') };
}

export function diffSummary(result: DiffResult): string {
  return `Added ${result.added} · Removed ${result.removed} · Unchanged ${result.unchanged}`;
}
