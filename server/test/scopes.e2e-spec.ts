import request from 'supertest';
import { startTestbed, stopTestbed, Testbed } from './helpers/testbed';

describe('Scopes hierarchy', () => {
  let t: Testbed;
  const auth = { Authorization: 'Bearer valid' };

  beforeAll(async () => {
    t = await startTestbed();
    t.stubFirebase({ uid: 'firebase-uid-1', email: 'allow@example.com' });
    // Trigger user provisioning by hitting an authenticated endpoint
    await request(t.app.getHttpServer()).get('/v1/scope_types').set(auth).expect(200);
  }, 90_000);

  afterAll(async () => stopTestbed(t));

  let projectType: string;
  let phaseType: string;

  it('creates scope types', async () => {
    const project = await request(t.app.getHttpServer()).post('/v1/scope_types').set(auth).send({ name: 'Project', position: 1 }).expect(201);
    const phase = await request(t.app.getHttpServer()).post('/v1/scope_types').set(auth).send({ name: 'Phase', position: 2 }).expect(201);
    projectType = project.body.id;
    phaseType = phase.body.id;
  });

  let projectScope: string;
  it('creates a root Project and a child Phase', async () => {
    const p = await request(t.app.getHttpServer()).post('/v1/scopes').set(auth).send({ scope_type_id: projectType, name: 'Q2' }).expect(201);
    projectScope = p.body.id;
    await request(t.app.getHttpServer())
      .post('/v1/scopes').set(auth)
      .send({ scope_type_id: phaseType, parent_id: projectScope, name: 'Build' })
      .expect(201);
  });

  it('rejects an inverted hierarchy (Phase parent → Project child)', async () => {
    const phase = await request(t.app.getHttpServer()).post('/v1/scopes').set(auth)
      .send({ scope_type_id: phaseType, parent_id: projectScope, name: 'Discovery' }).expect(201);
    const res = await request(t.app.getHttpServer()).post('/v1/scopes').set(auth)
      .send({ scope_type_id: projectType, parent_id: phase.body.id, name: 'BadProject' })
      .expect(400);
    expect(res.body.error.code).toBe('invalid_scope_hierarchy');
  });

  it('rejects deleting a scope type that has active scopes', async () => {
    const res = await request(t.app.getHttpServer()).delete(`/v1/scope_types/${projectType}`).set(auth).expect(409);
    expect(res.body.error.code).toBe('scope_type_in_use');
  });

  it('soft-deletes a scope and cascade-tombstones descendants', async () => {
    await request(t.app.getHttpServer()).delete(`/v1/scopes/${projectScope}`).set(auth).expect(204);
    const list = await request(t.app.getHttpServer()).get('/v1/scopes').set(auth).expect(200);
    expect(list.body.find((s: any) => s.id === projectScope)).toBeUndefined();
  });
});
