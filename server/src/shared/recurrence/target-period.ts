export type TargetPeriod = 'day' | 'week';

const MS_PER_DAY = 86_400_000;

export function periodBoundsUtc(period: TargetPeriod, ref: Date): { start: Date; end: Date } {
  const start = new Date(ref);
  start.setUTCHours(0, 0, 0, 0);
  if (period === 'day') {
    const end = new Date(start.getTime() + MS_PER_DAY);
    return { start, end };
  }
  // ISO week: Monday is day 0
  const dow = (start.getUTCDay() + 6) % 7;
  const weekStart = new Date(start.getTime() - dow * MS_PER_DAY);
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);
  return { start: weekStart, end: weekEnd };
}

export function isTargetMet(sum: number, targetValue: number): boolean {
  return sum >= targetValue;
}
