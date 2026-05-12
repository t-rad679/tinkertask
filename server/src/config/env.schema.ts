import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  // Comma-separated list of allowed sign-in identities. Each entry is either
  //   - a literal email (`alice@example.com`), case-insensitive, or
  //   - a domain wildcard (`@example.com`).
  // The schema requires this to be non-empty by design: this instance is
  // invite-only (§12 of the spec). To allow all Firebase-verified users on
  // a domain, set the value to a wildcard like `@example.com`.
  AUTH_EMAIL_ALLOWLIST: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
