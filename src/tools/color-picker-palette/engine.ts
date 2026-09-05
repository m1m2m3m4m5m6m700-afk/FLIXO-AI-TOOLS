export type Rgb = { r: number; g: number; b: number };

const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error('Invalid HEX color');
  return { r: Number.parseInt(expanded.slice(0, 2), 16), g: Number.parseInt(expanded.slice(2, 4), 16), b: Number.parseInt(expanded.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[clamp(r), clamp(g), clamp(b)].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const red = r / 255; const green = g / 255; const blue = b / 255;
  const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const delta = max - min;
  let h = 0; const l = (max + min) / 2; const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminance(foreground); const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function palette(base: Rgb, count = 5): string[] {
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const factor = count === 1 ? 0.5 : index / (count - 1);
    values.push(rgbToHex({ r: base.r * (1 - factor) + 255 * factor, g: base.g * (1 - factor) + 255 * factor, b: base.b * (1 - factor) + 255 * factor }));
  }
  return values;
}

export function tailwindToken(hex: string): string { return `color: '${hex}'`; }
