import { HierarchyValidator } from './hierarchy.validator';

describe('HierarchyValidator', () => {
  const types = new Map<string, { position: number }>([
    ['t-project', { position: 1 }],
    ['t-phase',   { position: 2 }],
    ['t-sub',     { position: 3 }],
  ]);

  const v = new HierarchyValidator();

  it('allows lower-position parent', () => {
    expect(() => v.validate(types, 't-project', 't-phase')).not.toThrow();
    expect(() => v.validate(types, 't-project', 't-sub')).not.toThrow();
  });

  it('rejects same-position parent', () => {
    expect(() => v.validate(types, 't-phase', 't-phase')).toThrow();
  });

  it('rejects inverted hierarchy', () => {
    expect(() => v.validate(types, 't-sub', 't-project')).toThrow();
  });

  it('allows root scope (no parent)', () => {
    expect(() => v.validate(types, null, 't-project')).not.toThrow();
    expect(() => v.validate(types, null, 't-sub')).not.toThrow();
  });

  it('throws when type missing', () => {
    expect(() => v.validate(types, 't-project', 't-missing')).toThrow();
  });
});
