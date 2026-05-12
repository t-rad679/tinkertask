import request from 'supertest';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

describe('Views', () => {
  let t: Testbed;
  const auth = { Authorization: 'Bearer valid' };

  beforeAll(async () => {
    t = await startTestbed();
    t.stubFirebase({ uid: 'firebase-uid-1', email: 'allow@example.com' });
    await request(t.app.getHttpServer()).get('/v1/views').set(auth).expect(200);

    // Seed: two tasks, two habits
    await request(t.app.getHttpServer())
      .post('/v1/tasks')
      .set(auth)
      .send({ title: 'Pay rent', kind: 'task' })
      .expect(201);
    await request(t.app.getHttpServer())
      .post('/v1/tasks')
      .set(auth)
      .send({ title: 'Reply to Sarah', kind: 'task' })
      .expect(201);
    await request(t.app.getHttpServer())
      .post('/v1/tasks')
      .set(auth)
      .send({ title: 'Push-ups', kind: 'habit', target_value: 50, target_period: 'day' })
      .expect(201);
    await request(t.app.getHttpServer())
      .post('/v1/tasks')
      .set(auth)
      .send({ title: 'Meditate', kind: 'habit', target_value: 1, target_period: 'day' })
      .expect(201);
  }, 90_000);

  afterAll(async () => stopTestbed(t));

  it('creates a view and runs it (saved view run)', async () => {
    const v = await request(t.app.getHttpServer())
      .post('/v1/views')
      .set(auth)
      .send({
        name: 'Habits',
        query: { filter: { kind: ['habit'] } },
      })
      .expect(201);

    const results = await request(t.app.getHttpServer())
      .post(`/v1/views/${v.body.id}/run`)
      .set(auth)
      .expect(201);

    const titles = (results.body as Array<{ title: string }>).map((r) => r.title).sort();
    expect(titles).toEqual(['Meditate', 'Push-ups']);
  });

  it('runs an inline query for open tasks', async () => {
    const results = await request(t.app.getHttpServer())
      .post('/v1/views/run')
      .set(auth)
      .send({
        query: { filter: { kind: ['task'], status: ['open'] } },
      })
      .expect(201);

    expect((results.body as unknown[]).length).toBe(2);
  });

  it('rejects an invalid query', async () => {
    const res = await request(t.app.getHttpServer())
      .post('/v1/views/run')
      .set(auth)
      .send({
        query: { filter: { evil: 1 } },
      })
      .expect(400);

    expect(res.body.error.code).toBe('invalid_query');
  });
});
