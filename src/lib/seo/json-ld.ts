export function serializeJsonLd(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('JSON-LD payload must be serializable.');
  return serialized.replaceAll('<', '\\u003c');
}
