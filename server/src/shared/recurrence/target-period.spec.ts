import { periodBoundsUtc, isTargetMet } from './target-period';

describe('target-period', () => {
  it('day bounds — Mon 2026-05-11', () => {
    const { start, end } = periodBoundsUtc('day', new Date('2026-05-11T15:30:00Z'));
    expect(start.toISOString()).toBe('2026-05-11T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-12T00:00:00.000Z');
  });
  it('week bounds — Wed 2026-05-13 → Mon 11 .. Mon 18', () => {
    const { start, end } = periodBoundsUtc('week', new Date('2026-05-13T15:30:00Z'));
    expect(start.toISOString()).toBe('2026-05-11T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-18T00:00:00.000Z');
  });
  it('isTargetMet uses ≥', () => {
    expect(isTargetMet(2, 3)).toBe(false);
    expect(isTargetMet(3, 3)).toBe(true);
    expect(isTargetMet(4, 3)).toBe(true);
  });
});
