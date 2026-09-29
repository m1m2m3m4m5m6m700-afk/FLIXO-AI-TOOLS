import { z } from 'zod';

const requestSchema = z.object({
  expression: z.string().trim().min(1).max(512),
}).strict();

export type MathSolveParams = z.infer<typeof requestSchema>;

export type MathReceipt = Readonly<{
  expression: string;
  value: number;
  timestamp: string;
  finite: true;
  exactInput: true;
  engine: 'FLIXO-DETERMINISTIC-MATH-v1';
}>;

const NUMBER = /^\d+(?:\.\d+)?$/u;
const TOKEN = /^(?:\d+(?:\.\d+)?|[()+\-*/%^])$/u;

function tokenize(expression: string): string[] {
  const compact = expression.replace(/\s+/g, '');
  const raw = compact.match(/(?:\d+(?:\.\d+)?|[()+\-*/%^])/g) ?? [];
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
    if (!token || !NUMBER.test(token)) throw new Error('MATH_EXPECTED_NUMBER');
    return Number(token);
  };

  const power = (): number => {
    const left = primary();
    if (peek() === '^') { consume(); return left ** power(); }
    return left;
  };

  const multiplicative = (): number => {
    let value = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const operator = consume();
      const right = power();
      if ((operator === '/' || operator === '%') && right === 0) {
        throw new Error('MATH_DIVISION_BY_ZERO');
      }
      if (operator === '*') value *= right;
      else if (operator === '/') value /= right;
      else value %= right;
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

export function solveMath({ expression }: MathSolveParams): MathReceipt {
  const request = requestSchema.parse({ expression });
  const normalizedExpression = request.expression;
  const value = evaluateTokens(tokenize(normalizedExpression));

  if (!Number.isFinite(value)) throw new Error('MATH_NON_FINITE_RESULT');

  return Object.freeze({
    expression: normalizedExpression,
    value,
    timestamp: new Date().toISOString(),
    finite: true,
    exactInput: true,
    engine: 'FLIXO-DETERMINISTIC-MATH-v1' as const,
  });
}

export function verifyMathReceipt(receipt: MathReceipt): boolean {
  if (
    receipt.engine !== 'FLIXO-DETERMINISTIC-MATH-v1' ||
    !receipt.finite ||
    !receipt.exactInput ||
    typeof receipt.timestamp !== 'string'
  ) return false;

  try {
    return Object.is(
      solveMath({ expression: receipt.expression }).value,
      receipt.value,
    );
  } catch {
    return false;
  }
}
