export const normalizeIntent = (input: string): string =>
  input
    .trim()
    .toLocaleLowerCase('ar')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

export const includesTerm = (normalized: string, term: string): boolean => {
  const candidate = normalizeIntent(term);
  return candidate.length > 0 && normalized.includes(candidate);
};
