import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => {
        const result = envSchema.safeParse(raw);
        if (!result.success) {
          throw new Error(`Invalid environment:\n${result.error.toString()}`);
        }
        return result.data;
      },
    }),
  ],
})
export class AppConfigModule {}
