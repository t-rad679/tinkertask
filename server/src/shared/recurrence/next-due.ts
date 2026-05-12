import { Recurrence } from './recurrence.types';

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Returns the next due date AT OR AFTER `from`, given the recurrence and an anchor (createdAt).
 * Date-grain; UTC.
 */
export function nextDueDate(rec: Recurrence, anchor: Date, from: Date): Date {
  const cursor = startOfDay(from);

  switch (rec.kind) {
    case 'daily':
      return cursor;
    case 'weekdays': {
      const dow = (cursor.getUTCDay() + 6) % 7; // Mon=0
      if (dow <= 4) return cursor;
      return new Date(cursor.getTime() + (7 - dow) * MS_PER_DAY);
    }
    case 'weekly': {
      const allowed = new Set(rec.byweekday ?? []);
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor.getTime() + i * MS_PER_DAY);
        const dow = (d.getUTCDay() + 6) % 7;
        if (allowed.has(dow)) return d;
      }
      throw new Error('weekly recurrence has empty byweekday');
    }
    case 'monthly': {
      const day = rec.byday!;
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
      if (candidate >= cursor) return candidate;
      return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, day));
    }
    case 'every_n_days': {
      const n = rec.every!;
      const anchorDay = startOfDay(anchor);
      const diffDays = Math.floor((cursor.getTime() - anchorDay.getTime()) / MS_PER_DAY);
      const remainder = ((diffDays % n) + n) % n;
      const addDays = remainder === 0 ? 0 : n - remainder;
      return new Date(cursor.getTime() + addDays * MS_PER_DAY);
    }
  }
}
