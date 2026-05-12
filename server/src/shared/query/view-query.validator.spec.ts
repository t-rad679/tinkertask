import { validateViewQuery } from './view-query.validator';

describe('view query validator', () => {
  it('accepts a minimal filter', () => {
    expect(validateViewQuery({ filter: { kind: ['habit'] } }).ok).toBe(true);
  });
  it('rejects unknown fields', () => {
    expect(validateViewQuery({ filter: { evil: 1 } }).ok).toBe(false);
  });
  it('rejects bad tag UUIDs', () => {
    expect(validateViewQuery({ filter: { tags: { any: ['not-a-uuid'] } } }).ok).toBe(false);
  });
});
