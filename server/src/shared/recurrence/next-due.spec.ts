import { nextDueDate } from './next-due';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('nextDueDate', () => {
  it('daily — returns the day itself', () => {
    expect(nextDueDate({ kind: 'daily' }, d('2026-01-01'), d('2026-05-11'))).toEqual(d('2026-05-11'));
  });
  it('weekdays — Saturday rolls to Monday', () => {
    expect(nextDueDate({ kind: 'weekdays' }, d('2026-01-01'), d('2026-05-09'))).toEqual(d('2026-05-11'));
  });
  it('weekly Mon/Wed/Fri — Tuesday rolls to Wednesday', () => {
    expect(nextDueDate({ kind: 'weekly', byweekday: [0, 2, 4] }, d('2026-01-01'), d('2026-05-12'))).toEqual(d('2026-05-13'));
  });
  it('monthly byday=15 — May 11 rolls to May 15', () => {
    expect(nextDueDate({ kind: 'monthly', byday: 15 }, d('2026-01-01'), d('2026-05-11'))).toEqual(d('2026-05-15'));
  });
  it('monthly byday=1 — May 11 rolls to June 1', () => {
    expect(nextDueDate({ kind: 'monthly', byday: 1 }, d('2026-01-01'), d('2026-05-11'))).toEqual(d('2026-06-01'));
  });
  it('every_n_days every=3 — anchor May 1, asking from May 11 → May 13', () => {
    expect(nextDueDate({ kind: 'every_n_days', every: 3 }, d('2026-05-01'), d('2026-05-11'))).toEqual(d('2026-05-13'));
  });
});
