export type JsonObject = Record<string, unknown>;

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number; column: number };

const getLineColumn = (text: string, index: number) => {
  const before = text.slice(0, Math.max(0, index));
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1)?.length ? (lines.at(-1)?.length ?? 0) + 1 : 1 };
};

export function parseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const match = message.match(/position (\d+)/i);
    const index = match ? Number(match[1]) : 0;
    const { line, column } = getLineColumn(text, index);
    return { ok: false, message, line, column };
  }
}

export function prettifyJson(text: string, spaces: 2 | 4): JsonParseResult & { formatted?: string } {
  const result = parseJson(text);
  return result.ok ? { ...result, formatted: JSON.stringify(result.value, null, spaces) } : result;
}

export function minifyJson(text: string): JsonParseResult & { formatted?: string } {
  const result = parseJson(text);
  return result.ok ? { ...result, formatted: JSON.stringify(result.value) } : result;
}

export function flattenObject(value: unknown, prefix = ''): JsonObject {
  if (Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [prefix ? `${prefix}.${index}` : String(index), item]));
  if (value && typeof value === 'object') {
    const entries: JsonObject = {};
    for (const [key, child] of Object.entries(value as JsonObject)) {
      const next = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child)) Object.assign(entries, flattenObject(child, next));
      else entries[next] = child;
    }
    return entries;
  }
  return prefix ? { [prefix]: value } : { value };
}

export function jsonToCsv(value: unknown): string {
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length) return '';
  const flatRows = rows.map((row) => flattenObject(row));
  const headers = [...new Set(flatRows.flatMap((row) => Object.keys(row)))];
  const quote = (cell: unknown) => `"${String(cell ?? '').replaceAll('"', '""')}"`;
  return [headers.map(quote).join(','), ...flatRows.map((row) => headers.map((header) => quote(row[header])).join(','))].join('\n');
}

export function jsonToYaml(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) return value.map((item) => `${pad}- ${jsonToYaml(item, indent + 2).trimStart()}`).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value as JsonObject)
      .map(([key, child]) => {
        if (child && typeof child === 'object') return `${pad}${key}:\n${jsonToYaml(child, indent + 2)}`;
        return `${pad}${key}: ${yamlScalar(child)}`;
      })
      .join('\n');
  }
  return `${pad}${yamlScalar(value)}`;
}

function yamlScalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return /[:#\n\[\]{},&*!|>'"%@`]/.test(value) ? JSON.stringify(value) : value;
  return String(value);
}
