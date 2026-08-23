export type TextStats = {
  text: string;
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  speakingMinutes: number;
  keywords: Array<{ word: string; count: number; density: number }>;
};

const WORDS_PER_MINUTE_READING = 200;
const WORDS_PER_MINUTE_SPEAKING = 130;

function tokenizeWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

function countSentences(text: string): number {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (!normalized) return 0;
  return (normalized.match(/[.!?؟。]+(?=\s|$)/gu) ?? []).length || 1;
}

function countParagraphs(text: string): number {
  return text.trim() ? text.trim().split(/\n\s*\n+/u).length : 0;
}

export function analyzeText(text: string, keywordLimit = 10): TextStats {
  const words = tokenizeWords(text);
  const normalizedKeywords = words.map((word) => word.toLocaleLowerCase()).filter((word) => word.length >= 2);
  const counts = new Map<string, number>();

  for (const word of normalizedKeywords) counts.set(word, (counts.get(word) ?? 0) + 1);

  const keywordTotal = words.length || 1;
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, keywordLimit))
    .map(([word, count]) => ({ word, count, density: Number(((count / keywordTotal) * 100).toFixed(2)) }));

  return {
    text,
    words: words.length,
    characters: [...text].length,
    charactersNoSpaces: [...text].filter((character) => !/\s/u.test(character)).length,
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    readingMinutes: words.length ? Number((words.length / WORDS_PER_MINUTE_READING).toFixed(2)) : 0,
    speakingMinutes: words.length ? Number((words.length / WORDS_PER_MINUTE_SPEAKING).toFixed(2)) : 0,
    keywords,
  };
}
