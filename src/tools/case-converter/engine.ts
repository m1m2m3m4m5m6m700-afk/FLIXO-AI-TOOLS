export type CaseMode =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant';

export function wordTokens(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

function titleToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toLocaleUpperCase() + token.slice(1).toLocaleLowerCase();
}

export function convertCase(text: string, mode: CaseMode): string {
  if (!text) return '';
  switch (mode) {
    case 'upper': return text.toLocaleUpperCase();
    case 'lower': return text.toLocaleLowerCase();
    case 'title': return wordTokens(text).map(titleToken).join(' ');
    case 'sentence': {
      const lowered = text.toLocaleLowerCase();
      let capitalize = true;
      return [...lowered].map((character) => {
        if (capitalize && /\p{L}/u.test(character)) {
          capitalize = false;
          return character.toLocaleUpperCase();
        }
        if (/[.!?؟。]/u.test(character)) capitalize = true;
        return character;
      }).join('');
    }
    case 'camel': {
      const tokens = wordTokens(text).map((token) => token.toLocaleLowerCase());
      return tokens.map((token, index) => index === 0 ? token : titleToken(token)).join('');
    }
    case 'pascal': return wordTokens(text).map((token) => titleToken(token)).join('');
    case 'snake': return wordTokens(text).map((token) => token.toLocaleLowerCase()).join('_');
    case 'kebab': return wordTokens(text).map((token) => token.toLocaleLowerCase()).join('-');
    case 'constant': return wordTokens(text).map((token) => token.toLocaleUpperCase()).join('_');
  }
}
