import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('round-trips an object', () => {
    const c = { updatedAt: '2026-05-11T00:00:00Z', id: 'abc' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('returns null for null/undefined/empty inputs', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('throws on tampered cursors', () => {
    expect(() => decodeCursor('not-base64!!')).toThrow();
  });
});
