import { config } from '../config.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days from today until the date. Negative means the date has passed.
export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const d = new Date(date);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / MS_PER_DAY);
}

export function computeExpiryStatus(expiryDate, warningDays = config.expiryWarningDays) {
  const days = daysUntil(expiryDate);
  if (days === null) return 'no_expiry';
  if (days < 0) return 'expired';
  if (days <= warningDays) return 'expiring_soon';
  return 'valid';
}

// Accepts YYYY-MM-DD (preferred) or DD/MM/YYYY and DD-MM-YYYY. Returns a UTC-midnight Date,
// null for empty input, or undefined when the value is not a real date.
export function parseDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const text = String(value).trim();
  if (!text) return null;

  let year, month, day;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (match) {
    [, year, month, day] = match;
  } else if ((match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) {
    [, day, month, year] = match;
  } else {
    return undefined;
  }

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const valid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  return valid ? date : undefined;
}
