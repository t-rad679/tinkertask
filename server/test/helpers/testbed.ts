import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/common/errors/http-exception.filter';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';

// ---------------------------------------------------------------------------
// Stub FirebaseService — used via overrideProvider so the real SDK never inits
// with fake credentials during e2e tests.
// ---------------------------------------------------------------------------
@Injectable()
export class StubFirebaseService {
  private stubbed: { uid: string; email: string } | null = null;

  setStub(decoded: { uid: string; email: string } | null) {
    this.stubbed = decoded;
  }

  async verifyIdToken(token: string): Promise<{ uid: string; email: string }> {
    if (!this.stubbed) throw new Error('StubFirebaseService: not configured for this test');
    if (token !== 'valid') throw new Error('StubFirebaseService: invalid token');
    return this.stubbed;
  }
}

// ---------------------------------------------------------------------------

export interface Testbed {
  app: INestApplication;
  db: ReturnType<typeof drizzle<typeof schema>>;
  pg: StartedPostgreSqlContainer;
  client: ReturnType<typeof postgres>;
  stubFirebase(decoded: { uid: string; email: string }): void;
}

export interface TestbedOpts {
  allowlist?: string;
  extraModules?: unknown[];
}

export async function startTestbed(opts: TestbedOpts = {}): Promise<Testbed> {
  // Start Postgres container
  const pg = await new PostgreSqlContainer('postgres:16').start();
  const url = pg.getConnectionUri();

  // Set env vars BEFORE building the Nest module (env schema validated at startup)
  process.env['DATABASE_URL'] = url;
  process.env['AUTH_EMAIL_ALLOWLIST'] = opts.allowlist ?? 'allow@example.com';
  process.env['FIREBASE_PROJECT_ID'] = 'p';
  process.env['FIREBASE_CLIENT_EMAIL'] = 'c@x';
  process.env['FIREBASE_PRIVATE_KEY'] =
    '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n';
  process.env['NODE_ENV'] = 'test';
  process.env['PORT'] = '8080';

  // Create a postgres client for migrations + direct DB access in tests
  const client = postgres(url, { max: 5 });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: 'src/db/migrations' });

  // Dynamic import of AppModule after env vars are set
  const { AppModule } = await import('../../src/app.module');
  const { FirebaseService } = await import('../../src/auth/firebase.service');

  const stubFirebaseService = new StubFirebaseService();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule, ...((opts.extraModules ?? []) as any[])],
  })
    .overrideProvider(FirebaseService)
    .useValue(stubFirebaseService)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();

  return {
    app,
    db,
    pg,
    client,
    stubFirebase(decoded) {
      stubFirebaseService.setStub(decoded);
    },
  };
}

export async function stopTestbed(t: Testbed): Promise<void> {
  await t.app.close();
  await t.client.end();
  await t.pg.stop();
}
