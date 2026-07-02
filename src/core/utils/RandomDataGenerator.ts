import * as crypto from 'crypto';

/** 8-char hex tag unique to this test run — embedded in all created record names */
export const RUN_TAG: string = crypto.randomBytes(4).toString('hex').toUpperCase();

/**
 * Generates a unique name for a test record.
 * Format: [TEST] {base} {RUN_TAG}
 * The [TEST] prefix makes records easy to filter/delete manually if needed.
 */
export function uniqueName(base: string): string {
  return `[TEST] ${base} ${RUN_TAG}`;
}

/** Generates a unique email address for test users */
export function uniqueEmail(localPart: string): string {
  return `${localPart}.${RUN_TAG.toLowerCase()}@test.example.com`;
}

/** Generates a unique reference code (for contracts, payslips, etc.) */
export function uniqueRef(prefix: string): string {
  return `${prefix}-${RUN_TAG}`;
}

/** Random integer between min and max (inclusive) */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random element from an array */
export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
