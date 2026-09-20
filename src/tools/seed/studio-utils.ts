export function signedValue(value: number, unit = '') {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`;
}
