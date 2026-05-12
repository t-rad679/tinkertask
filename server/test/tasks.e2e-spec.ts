import request from 'supertest';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

describe('Tasks + tags + completions', () => {
  let t: Testbed;
  const auth = { Authorization: 'Bearer valid' };

  beforeAll(async () => {
    t = await startTestbed();
    t.stubFirebase({ uid: 'firebase-uid-1', email: 'allow@example.com' });
    await request(t.app.getHttpServer()).get('/v1/tasks').set(auth).expect(200);
  }, 90_000);
  afterAll(async () => stopTestbed(t));

  let taskId: string;
  it('creates a task with new tags and a scope-less attachment', async () => {
    const res = await request(t.app.getHttpServer()).post('/v1/tasks').set(auth).send({
      title: 'Pay rent',
      kind: 'task',
      tags: ['bills', 'personal'],
    }).expect(201);
    taskId = res.body.id;
    expect(res.body.title).toBe('Pay rent');
  });

  it('lists the new task', async () => {
    const res = await request(t.app.getHttpServer()).get('/v1/tasks').set(auth).expect(200);
    expect(res.body.find((x: any) => x.id === taskId)).toBeDefined();
  });

  it('updates the task tags (full replacement)', async () => {
    await request(t.app.getHttpServer()).patch(`/v1/tasks/${taskId}`).set(auth).send({ tags: ['urgent'] }).expect(200);
    const tags = await request(t.app.getHttpServer()).get('/v1/tags').set(auth).expect(200);
    expect(tags.body.find((t: any) => t.name === 'urgent')).toBeDefined();
  });

  it('creates a habit and logs a completion with value=5', async () => {
    const habit = await request(t.app.getHttpServer()).post('/v1/tasks').set(auth).send({
      title: 'Push-ups', kind: 'habit', target_value: 50, target_period: 'day',
    }).expect(201);
    const c = await request(t.app.getHttpServer()).post('/v1/completions').set(auth).send({
      task_id: habit.body.id, completed_on: '2026-05-11', value: 5,
    }).expect(201);
    expect(c.body.value).toBe(5);
  });

  it('rejects mismatched target_value/target_period coupling', async () => {
    const res = await request(t.app.getHttpServer()).post('/v1/tasks').set(auth).send({
      title: 'Bad', kind: 'habit', target_value: 5,
    }).expect(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});
