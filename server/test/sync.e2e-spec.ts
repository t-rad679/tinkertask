import request from 'supertest';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

describe('Sync', () => {
  let t: Testbed;
  const auth = { Authorization: 'Bearer valid' };

  beforeAll(async () => {
    t = await startTestbed();
    t.stubFirebase({ uid: 'firebase-uid-1', email: 'allow@example.com' });
    // Warm up / ensure user is upserted
    await request(t.app.getHttpServer()).get('/v1/tasks').set(auth).expect(200);
  }, 90_000);

  afterAll(async () => stopTestbed(t));

  it('returns empty delta when since is "now"', async () => {
    const since = new Date().toISOString();
    const res = await request(t.app.getHttpServer())
      .get(`/v1/sync?since=${encodeURIComponent(since)}`)
      .set(auth)
      .expect(200);

    expect(res.body.next_cursor).toBeNull();
    expect(res.body.now).toBeDefined();
    expect(Array.isArray(res.body.data.tasks)).toBe(true);
    expect(res.body.data.tasks).toHaveLength(0);
    expect(res.body.data.completions).toHaveLength(0);
    expect(res.body.data.scopes).toHaveLength(0);
    expect(res.body.data.tags).toHaveLength(0);
    expect(res.body.data.views).toHaveLength(0);
    expect(res.body.data.dashboards).toHaveLength(0);
  });

  it('returns a new task in the delta after creation', async () => {
    const since = new Date().toISOString();

    // Wait a moment to ensure the task's created_at/updated_at is after `since`
    await new Promise((r) => setTimeout(r, 10));

    await request(t.app.getHttpServer())
      .post('/v1/tasks')
      .set(auth)
      .send({ title: 'Sync test task', kind: 'task' })
      .expect(201);

    const res = await request(t.app.getHttpServer())
      .get(`/v1/sync?since=${encodeURIComponent(since)}`)
      .set(auth)
      .expect(200);

    const taskTitles = (res.body.data.tasks as Array<{ title: string }>).map((t) => t.title);
    expect(taskTitles).toContain('Sync test task');
  });
});
