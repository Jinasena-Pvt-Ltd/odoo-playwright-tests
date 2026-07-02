export interface BoundaryValues {
  belowMin: number;
  atMin: number;
  aboveMin: number;
  belowMax: number;
  atMax: number;
  aboveMax: number;
  zero: number;
  negative: number;
  veryLarge: number;
  verySmall: number;
  negativeVeryLarge: number;
}

/**
 * Generates boundary test values around a [min, max] range.
 * Covers the -1 / 0 / +1 pattern from validation limits (Step 7.1).
 */
export function generateBoundaryValues(min: number, max: number): BoundaryValues {
  return {
    belowMin: min - 1,
    atMin: min,
    aboveMin: min + 1,
    belowMax: max - 1,
    atMax: max,
    aboveMax: max + 1,
    zero: 0,
    negative: -1,
    veryLarge: 999_999_999_999,
    verySmall: 0.000001,
    negativeVeryLarge: -999_999_999_999,
  };
}

export interface TextEdgeCase {
  value: string;
  label: string;
}

/** Text edge cases for string field testing (Step 7.4) */
export const TEXT_EDGE_CASES: TextEdgeCase[] = [
  { value: '', label: 'empty string' },
  { value: ' ', label: 'whitespace only' },
  { value: '  ', label: 'multiple spaces' },
  { value: 'A'.repeat(256), label: '256 chars (overflow)' },
  { value: 'A'.repeat(1024), label: '1024 chars (large)' },
  { value: '<script>alert(1)</script>', label: 'XSS attempt' },
  { value: "O'Brien & Co.", label: 'special chars: quote, ampersand' },
  { value: '123', label: 'numeric string' },
  { value: '123.45', label: 'float as text' },
  { value: '-1', label: 'negative number as text' },
  { value: '0', label: 'zero as text' },
  { value: '日本語テスト', label: 'unicode / CJK characters' },
  { value: 'test@example.com', label: 'email-like string' },
  { value: '\n\t\r', label: 'whitespace control chars' },
];

/** Float edge cases for monetary/float field testing (Step 7.3) */
export const FLOAT_EDGE_CASES: Array<{ value: number; label: string }> = [
  { value: 0.1 + 0.2, label: 'floating-point precision (0.1 + 0.2)' },
  { value: 0.000001, label: 'very small positive' },
  { value: -0.000001, label: 'very small negative' },
  { value: 0.005, label: 'rounding boundary (.005)' },
  { value: 999999999.99, label: 'large float' },
  { value: -999999999.99, label: 'large negative float' },
];

/** Rounds a number to `decimals` places (same logic Odoo uses for monetary fields) */
export function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
