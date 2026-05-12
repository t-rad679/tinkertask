import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';

describe('DB smoke', () => {
  let container: StartedPostgreSqlContainer;
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16').start();
    client = postgres(container.getConnectionUri(), { max: 5 });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: 'src/db/migrations' });
  }, 60_000);

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  it('inserts and reads a user', async () => {
    await db.insert(schema.users).values({ id: 'firebase-uid-1' });
    const rows = await db.select().from(schema.users);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('firebase-uid-1');
  });

  it('inserts a scope_type, scope, and task', async () => {
    const [st] = await db.insert(schema.scopeTypes).values({ userId: 'firebase-uid-1', name: 'Project', position: 1 }).returning();
    const [scope] = await db.insert(schema.scopes).values({ userId: 'firebase-uid-1', scopeTypeId: st!.id, name: 'Q2 Initiative' }).returning();
    const [task] = await db.insert(schema.tasks).values({ userId: 'firebase-uid-1', scopeId: scope!.id, title: 'Pay rent', kind: 'task' }).returning();
    expect(task!.title).toBe('Pay rent');
    expect(task!.kind).toBe('task');
    expect(task!.status).toBe('open');
  });

  it('enforces tasks_target_coupling check', async () => {
    await expect(
      db.execute(sql`INSERT INTO tasks (user_id, title, kind, target_value) VALUES ('firebase-uid-1', 'bad', 'habit', 5)`),
    ).rejects.toThrow();
  });
});
