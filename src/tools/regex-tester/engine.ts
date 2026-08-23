export type RegexFlags = { global: boolean; ignoreCase: boolean; multiline: boolean; dotAll: boolean; unicode: boolean; sticky: boolean };

export type RegexMatch = { index: number; text: string; groups: string[] };

export function buildFlags(flags: RegexFlags): string {
  return [flags.global && 'g', flags.ignoreCase && 'i', flags.multiline && 'm', flags.dotAll && 's', flags.unicode && 'u', flags.sticky && 'y'].filter(Boolean).join('');
}

export function testRegex(pattern: string, input: string, flags: RegexFlags): { matches: RegexMatch[]; error: string | null } {
  try {
    const regex = new RegExp(pattern, buildFlags(flags));
    const matches: RegexMatch[] = [];
    if (!flags.global && !flags.sticky) {
      const match = regex.exec(input);
      if (match) matches.push({ index: match.index, text: match[0], groups: match.slice(1) });
      return { matches, error: null };
    }
    let match: RegExpExecArray | null = null;
    let guard = 0;
    while ((match = regex.exec(input)) !== null && guard < 10000) {
      matches.push({ index: match.index, text: match[0], groups: match.slice(1) });
      guard += 1;
      if (match[0] === '' && regex.lastIndex <= input.length) regex.lastIndex += 1;
    }
    return { matches, error: null };
  } catch (error) {
    return { matches: [], error: error instanceof Error ? error.message : 'Invalid regular expression.' };
  }
}
