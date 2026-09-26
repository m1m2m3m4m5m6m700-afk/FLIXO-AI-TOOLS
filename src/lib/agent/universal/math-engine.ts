import { z } from 'zod';

/**
 * Deterministic math substrate for FLIXO BOT.
 *
 * The language model may classify or explain a math request, but it must not
 * be the source of truth for arithmetic. This module deliberately accepts a
 * small, auditable expression grammar and returns a structured receipt.
 */

const requestSchema = z.object({
  expression: z.string().trim().min(1).max(512),
}).strict();

export type MathRequest = z.infer<typeof requestSchema>;
export type MathReceipt = Readonly<{
  expression: string;
  value: number;
  finite: true;
  exactInput: true;
  engine: 'FLIXO-DETERMINISTIC-MATH-v1';
}>;

const TOKEN = /^(?:[0-9]+(?:\\.[0-9]+)?|[()+\\-*/%^])$/;

function tokenize(expression: string): string[] {
  const compact = expression.replace(/\\s+/g, '');
  const raw = compact.match(/(?:[0-9]+(?:\\.[0-9]+)?|[()+\\-*/%^])/g) ?? [];
  if (raw.join('') !== compact || raw.some((token) => !TOKEN.test(token))) {
    throw new Error('MATH_EXPRESSION_UNSUPPORTED');
  }
  return raw;
}

function evaluateTokens(tokens: readonly string[]): number {
  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  const primary = (): number => {
    if (peek() === '+') { consume(); return primary(); }
    if (peek() === '-') { consume(); return -primary(); }
    if (peek() === '(') {
      consume();
      const value = additive();
      if (consume() !== ')') throw new Error('MATH_UNBALANCED_PARENS');
      return value;
    }
    const token = consume();
    if (!token || !/^\\d+(?:\\.\\d+)?$/.test(token)) throw new Error('MATH_EXPECTED_NUMBER');
    return Number(token);
  };

  const power = (): number => {
    const left = primary();
    if (peek() === '^') {
      consume();
      return left ** power();
    }
    return left;
  };

  const multiplicative = (): number => {
    let value = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const operator = consume();
      const right = power();
      if (operator === '*') value *= right;
      else if (operator === '/') {
        if (right === 0) throw new Error('MATH_DIVISION_BY_ZERO');
        value /= right;
      } else {
        if (right === 0) throw new Error('MATH_DIVISION_BY_ZERO');
        value %= right;
      }
    }
    return value;
  };

  function additive(): number {
    let value = multiplicative();
    while (peek() === '+' || peek() === '-') {
      const operator = consume();
      const right = multiplicative();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  const value = additive();
  if (index !== tokens.length) throw new Error('MATH_TRAILING_TOKENS');
  return value;
}

export function solveMath(input: unknown): MathReceipt {
  const request = requestSchema.parse(input);
  const expression = request.expression;
  const value = evaluateTokens(tokenize(expression));
  if (!Number.isFinite(value)) throw new Error('MATH_NON_FINITE_RESULT');
  return Object.freeze({
    expression,
    value,
    finite: true,
    exactInput: true,
    engine: 'FLIXO-DETERMINISTIC-MATH-v1' as const,
  });
}

export function verifyMathReceipt(receipt: MathReceipt): boolean {
  if (receipt.engine !== 'FLIXO-DETERMINISTIC-MATH-v1' || !receipt.finite || !receipt.exactInput) return false;
  try {
    return Object.is(solveMath({ expression: receipt.expression }).value, receipt.value);
  } catch {
    return false;
  }
}
