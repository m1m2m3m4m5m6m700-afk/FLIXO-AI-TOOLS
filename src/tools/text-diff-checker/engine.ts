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

const SUMMARY_LABELS: Record<string, readonly [string, string, string]> = {
  en: ['Added', 'Removed', 'Unchanged'],
  ar: ['أضيف', 'حُذف', 'دون تغيير'],
  es: ['Añadido', 'Eliminado', 'Sin cambios'],
  fr: ['Ajouté', 'Supprimé', 'Inchangé'],
  de: ['Hinzugefügt', 'Entfernt', 'Unverändert'],
  ru: ['Добавлено', 'Удалено', 'Без изменений'],
  zh: ['新增', '删除', '未更改'],
  hi: ['जोड़ा गया', 'हटाया गया', 'अपरिवर्तित'],
  id: ['Ditambahkan', 'Dihapus', 'Tidak berubah'],
  ur: ['شامل کیا گیا', 'حذف کیا گیا', 'کوئی تبدیلی نہیں'],
  ja: ['追加', '削除', '変更なし'],
  pt: ['Adicionado', 'Removido', 'Inalterado'],
  it: ['Aggiunti', 'Rimossi', 'Invariati'],
  ko: ['추가', '제거', '변경 없음'],
  nl: ['Toegevoegd', 'Verwijderd', 'Ongewijzigd'],
  pl: ['Dodano', 'Usunięto', 'Bez zmian'],
  tr: ['Eklenen', 'Kaldırılan', 'Değişmeyen'],
  vi: ['Đã thêm', 'Đã xóa', 'Không thay đổi'],
  th: ['เพิ่ม', 'ลบ', 'ไม่เปลี่ยนแปลง'],
  sv: ['Tillagda', 'Borttagna', 'Oförändrade'],
};

export function diffSummary(result: DiffResult): string {
  const rawLocale = typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en';
  const locale = rawLocale.toLowerCase().split('-')[0];
  const [added, removed, unchanged] = SUMMARY_LABELS[locale] ?? SUMMARY_LABELS.en;
  return `${added} ${result.added} · ${removed} ${result.removed} · ${unchanged} ${result.unchanged}`;
}
