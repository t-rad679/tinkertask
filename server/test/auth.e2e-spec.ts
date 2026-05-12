import request from 'supertest';
import { eq } from 'drizzle-orm';
import { Controller, Get, Module } from '@nestjs/common';
import { CurrentUser, AuthContext } from '../src/auth/user.decorator';
import { users } from '../src/db/schema';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

// A tiny probe controller that echoes back the authenticated user context
@Controller('whoami')
class WhoAmIController {
  @Get()
  me(@CurrentUser() user: AuthContext) {
    return user;
  }
}

@Module({ controllers: [WhoAmIController] })
class WhoAmIModule {}

describe('Auth', () => {
  let t: Testbed;

  beforeAll(async () => {
    t = await startTestbed({ allowlist: 'allow@example.com', extraModules: [WhoAmIModule] });
  }, 90_000);

  afterAll(async () => {
    await stopTestbed(t);
  });

  it('rejects requests without Authorization', async () => {
    await request(t.app.getHttpServer()).get('/v1/whoami').expect(401);
  });

  it('rejects emails not on the allowlist (403 email_not_allowlisted)', async () => {
    t.stubFirebase({ uid: 'firebase-uid-deny', email: 'deny@example.com' });
    const res = await request(t.app.getHttpServer())
      .get('/v1/whoami')
      .set('Authorization', 'Bearer valid')
      .expect(403);
    expect(res.body?.error?.code).toBe('email_not_allowlisted');
  });

  it('allows allowlisted emails and provisions a users row', async () => {
    t.stubFirebase({ uid: 'firebase-uid-allow', email: 'allow@example.com' });
    const res = await request(t.app.getHttpServer())
      .get('/v1/whoami')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(res.body.userId).toBe('firebase-uid-allow');
    expect(res.body.via).toBe('firebase');

    // Confirm a users row was actually persisted on first auth
    const rows = await t.db.select().from(users).where(eq(users.id, 'firebase-uid-allow'));
    expect(rows).toHaveLength(1);
  });
});
