import request from 'supertest';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

describe('/v1/parse', () => {
  let t: Testbed;
  const auth = { Authorization: 'Bearer valid' };
  beforeAll(async () => {
    t = await startTestbed();
    t.stubFirebase({ uid: 'firebase-uid-1', email: 'allow@example.com' });
    await request(t.app.getHttpServer()).get('/v1/tasks').set(auth).expect(200);
  }, 90_000);
  afterAll(async () => stopTestbed(t));

  it('parses a task with tag and scope', async () => {
    const res = await request(t.app.getHttpServer())
      .post('/v1/parse').set(auth).send({ text: 'pay rent #bills @personal repeat:monthly/1' }).expect(201);
    expect(res.body.title).toBe('pay rent');
    expect(res.body.tags).toEqual(['bills']);
    expect(res.body.scope).toBe('personal');
    expect(res.body.recurrence).toEqual({ kind: 'monthly', byday: 1 });
  });

  it('rejects habit + due', async () => {
    const res = await request(t.app.getHttpServer())
      .post('/v1/parse').set(auth).send({ text: 'meditate habit due:fri' }).expect(400);
    expect(res.body.error.code).toBe('parse_failed');
  });
});
