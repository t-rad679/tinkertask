import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL not set');
        const client = postgres(url, { max: 10 });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
