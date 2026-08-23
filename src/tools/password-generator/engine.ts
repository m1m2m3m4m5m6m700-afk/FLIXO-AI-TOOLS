export type PasswordOptions = {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
};

const SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/|~',
} as const;

const AMBIGUOUS = /[O0Il1|]/g;

function secureRandomIndex(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new Error('Invalid random range');
  const limit = Math.floor(0x100000000 / max) * max;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return values[0] % max;
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = secureRandomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function generatePassword(options: PasswordOptions): string {
  const length = Math.min(128, Math.max(4, Math.floor(options.length)));
  const selected = [
    options.uppercase ? SETS.uppercase : '',
    options.lowercase ? SETS.lowercase : '',
    options.numbers ? SETS.numbers : '',
    options.symbols ? SETS.symbols : '',
  ].filter(Boolean).map((set) => (options.excludeAmbiguous ? set.replace(AMBIGUOUS, '') : set));

  if (!selected.length) throw new Error('Select at least one character set');
  if (selected.some((set) => !set.length)) throw new Error('Selected character set is empty after exclusions');
  if (length < selected.length) throw new Error('Length must cover every selected character set');

  const all = selected.join('');
  const result = selected.map((set) => set[secureRandomIndex(set.length)]);
  while (result.length < length) result.push(all[secureRandomIndex(all.length)]);
  return shuffle(result).join('');
}

export function passwordStrength(password: string): 'Weak' | 'Fair' | 'Strong' | 'Very strong' {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 20) score += 1;
  if (/[A-Z]/u.test(password)) score += 1;
  if (/[a-z]/u.test(password)) score += 1;
  if (/\d/u.test(password)) score += 1;
  if (/[^A-Za-z0-9]/u.test(password)) score += 1;
  if (score >= 6) return 'Very strong';
  if (score >= 5) return 'Strong';
  if (score >= 3) return 'Fair';
  return 'Weak';
}
