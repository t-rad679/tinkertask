import { PatService } from './pat.service';

describe('PatService', () => {
  const svc = new PatService();

  it('generates tokens with the tt_pat_ prefix', () => {
    const t = svc.generateToken();
    expect(t).toMatch(/^tt_pat_[A-Za-z0-9_-]{40,}$/);
  });

  it('hash + verify round-trip', async () => {
    const t = svc.generateToken();
    const hash = await svc.hash(t);
    expect(await svc.verify(t, hash)).toBe(true);
    expect(await svc.verify('tt_pat_wrong', hash)).toBe(false);
  });
});
