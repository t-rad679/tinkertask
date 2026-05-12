import request from 'supertest';
import { sql } from 'drizzle-orm';
import { Controller, Get, Module } from '@nestjs/common';
import { CurrentUser, AuthContext } from '../src/auth/user.decorator';
import { users, personalAccessTokens } from '../src/db/schema';
import { PatService } from '../src/auth/pat.service';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

@Controller('whoami-pat')
class WhoAmIPatController {
  @Get()
  me(@CurrentUser() user: AuthContext) {
    return user;
  }
}

@Module({ controllers: [WhoAmIPatController] })
class WhoAmIPatModule {}

describe('PAT auth', () => {
  let t: Testbed;
  const tokens = new PatService();
  let validToken: string;

  beforeAll(async () => {
    t = await startTestbed({ extraModules: [WhoAmIPatModule] });

    // Seed: a user + one active PAT + one revoked PAT for the same user
    await t.db.insert(users).values({ id: 'firebase-uid-pat' });
    validToken = tokens.generateToken();
    const validHash = await tokens.hash(validToken);
    await t.db.insert(personalAccessTokens).values({
      userId: 'firebase-uid-pat',
      name: 'test-active',
      tokenHash: validHash,
    });

    const revokedToken = tokens.generateToken();
    const revokedHash = await tokens.hash(revokedToken);
    await t.db.insert(personalAccessTokens).values({
      userId: 'firebase-uid-pat',
      name: 'test-revoked',
      tokenHash: revokedHash,
      revokedAt: new Date(),
    });
    // Hold the revoked token in the closure for the relevant test
    (globalThis as Record<string, unknown>).revokedPat = revokedToken;
  }, 90_000);

  afterAll(async () => stopTestbed(t));

  it('accepts a valid active PAT and reports via=pat', async () => {
    const res = await request(t.app.getHttpServer())
      .get('/v1/whoami-pat')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    expect(res.body.userId).toBe('firebase-uid-pat');
    expect(res.body.via).toBe('pat');
    expect(res.body.patId).toBeDefined();
  });

  it('rejects a PAT-prefixed token that does not match any active hash', async () => {
    const unknownToken = tokens.generateToken();
    await request(t.app.getHttpServer())
      .get('/v1/whoami-pat')
      .set('Authorization', `Bearer ${unknownToken}`)
      .expect(401);
  });

  it('rejects a revoked PAT', async () => {
    const revoked = (globalThis as Record<string, unknown>).revokedPat as string;
    await request(t.app.getHttpServer())
      .get('/v1/whoami-pat')
      .set('Authorization', `Bearer ${revoked}`)
      .expect(401);
  });

  it('bumps last_used_at on successful PAT auth', async () => {
    // db.execute returns raw rows; timestamptz comes back as ISO string or Date depending on the driver.
    const readTs = (rows: unknown): number | null => {
      const r = (rows as Array<{ last_used_at: unknown }>)[0]?.last_used_at;
      if (!r) return null;
      return r instanceof Date ? r.getTime() : new Date(r as string).getTime();
    };

    const beforeTs = readTs(
      await t.db.execute(sql`SELECT last_used_at FROM personal_access_tokens WHERE name = 'test-active'`),
    );

    await request(t.app.getHttpServer())
      .get('/v1/whoami-pat')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    const afterTs = readTs(
      await t.db.execute(sql`SELECT last_used_at FROM personal_access_tokens WHERE name = 'test-active'`),
    );

    expect(afterTs).not.toBeNull();
    if (beforeTs !== null && afterTs !== null) {
      expect(afterTs).toBeGreaterThanOrEqual(beforeTs);
    }
  });
});
