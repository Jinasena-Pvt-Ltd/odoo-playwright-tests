/** Formats a Date as YYYY-MM-DD (Odoo date field format) */
export function toOdooDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Formats a Date as YYYY-MM-DD HH:MM:SS (Odoo datetime field format) */
export function toOdooDatetime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/** Parses an Odoo date string into a JS Date */
export function fromOdooDate(value: string): Date {
  return new Date(value + 'T00:00:00Z');
}

/** Returns today's date as YYYY-MM-DD */
export function today(): string {
  return toOdooDate(new Date());
}

/** Adds `days` to `date` and returns YYYY-MM-DD */
export function addDays(date: string, days: number): string {
  const d = fromOdooDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toOdooDate(d);
}

/** Returns the first day of the current month as YYYY-MM-DD */
export function firstOfMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Returns the last day of the current month as YYYY-MM-DD */
export function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return toOdooDate(last);
}
