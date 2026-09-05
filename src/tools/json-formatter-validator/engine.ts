export type JsonValidation = {
  readonly valid: boolean;
  readonly error?: string;
  readonly line?: number;
  readonly column?: number;
};

export type JsonTreeNode = {
  readonly key: string;
  readonly value: unknown;
  readonly type: string;
  readonly children?: readonly JsonTreeNode[];
};

export type JsonDocument = string | number | boolean | null | JsonDocument[] | { [key: string]: JsonDocument };

const YAML_UNSAFE_CHARS = new Set([':', '#', '\n', '[', ']', '{', '}', ',', '&', '*', '!', '|', '>', '\'', '"', '%', '@', '`']);

function errorLocation(message: string, input: string): { line: number; column: number } | null {
  const positionMatch = message.match(/position\s+(\d+)/i);
  if (positionMatch) {
    const position = Number(positionMatch[1]);
    const before = input.slice(0, position);
    return { line: before.split('\n').length, column: position - before.lastIndexOf('\n') };
  }

  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColumnMatch) {
    return { line: Number(lineColumnMatch[1]), column: Number(lineColumnMatch[2]) };
  }

  return null;
}

export function validateJson(input: string): JsonValidation {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const location = errorLocation(message, input);
    return location
      ? { valid: false, error: message, line: location.line, column: location.column }
      : { valid: false, error: message, line: 1, column: 1 };
  }
}

export function formatJson(input: string, spaces: 2 | 4): string {
  return JSON.stringify(JSON.parse(input), null, spaces);
}

export function minifyJson(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

function typeOfValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function buildJsonTree(value: unknown, key = 'root'): JsonTreeNode {
  if (Array.isArray(value)) {
    return {
      key,
      value,
      type: 'array',
      children: value.map((child, index) => buildJsonTree(child, String(index))),
    };
  }
  if (value && typeof value === 'object') {
    return {
      key,
      value,
      type: 'object',
      children: Object.entries(value).map(([childKey, childValue]) => buildJsonTree(childValue, childKey)),
    };
  }
  return { key, value, type: typeOfValue(value) };
}

function yamlScalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    const unsafe = Array.from(value).some((character) => YAML_UNSAFE_CHARS.has(character));
    return unsafe ? JSON.stringify(value) : value;
  }
  return String(value);
}

function toYamlValue(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    return value
      .map((child) => {
        if (child && typeof child === 'object') {
          const nested = toYamlValue(child, indent + 2).split('\n');
          return `${pad}- ${nested[0].trim()}${nested.length > 1 ? `\n${nested.slice(1).join('\n')}` : ''}`;
        }
        return `${pad}- ${yamlScalar(child)}`;
      })
      .join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, child]) => {
        if (child && typeof child === 'object') {
          return `${pad}${key}:\n${toYamlValue(child, indent + 2)}`;
        }
        return `${pad}${key}: ${yamlScalar(child)}`;
      })
      .join('\n');
  }
  return `${pad}${yamlScalar(value)}`;
}

export function toYaml(input: string): string {
  return toYamlValue(JSON.parse(input));
}

function csvEscape(value: unknown): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(input: string): string {
  const value = JSON.parse(input);
  if (!Array.isArray(value)) throw new Error('CSV conversion requires a JSON array of objects');
  const rows = value.filter((item): item is Record<string, unknown> => item && typeof item === 'object' && !Array.isArray(item));
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (keys.length === 0) return '';
  return [keys.join(','), ...rows.map((row) => keys.map((key) => csvEscape(row[key])).join(','))].join('\n');
}
