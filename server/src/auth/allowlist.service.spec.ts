import { AllowlistService } from './allowlist.service';
import { ConfigService } from '@nestjs/config';

const cfg = (list: string) => ({ get: () => list }) as unknown as ConfigService;

describe('AllowlistService', () => {
  it('matches exact emails case-insensitively', () => {
    const svc = new AllowlistService(cfg('Foo@Example.com, bar@example.com'));
    expect(svc.isAllowed('foo@example.com')).toBe(true);
    expect(svc.isAllowed('BAR@example.com')).toBe(true);
    expect(svc.isAllowed('baz@example.com')).toBe(false);
  });

  it('supports @domain wildcards', () => {
    const svc = new AllowlistService(cfg('@example.com'));
    expect(svc.isAllowed('anyone@example.com')).toBe(true);
    expect(svc.isAllowed('someone@other.com')).toBe(false);
  });

  it('rejects empty / missing', () => {
    const svc = new AllowlistService(cfg(''));
    expect(svc.isAllowed('a@b.com')).toBe(false);
  });
});
