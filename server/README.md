# tinkertask API Server

This is the backend API server for **tinkertask** — a NestJS + Drizzle ORM service that runs on Cloud Run and provides the REST API consumed by the Flutter mobile app.

**Spec:** [`docs/superpowers/specs/2026-05-11-tinkertask-api-first-design.md`](../docs/superpowers/specs/2026-05-11-tinkertask-api-first-design.md)
**Plan:** [`docs/superpowers/plans/2026-05-11-tinkertask-backend.md`](../docs/superpowers/plans/2026-05-11-tinkertask-backend.md)

## Overview

- **Runtime:** Node.js 22 (Alpine), TypeScript 5+
- **Framework:** NestJS 10+
- **ORM:** Drizzle ORM with explicit migrations
- **Database:** Postgres 16 (Cloud SQL in production, Docker locally)
- **Auth:** Firebase ID tokens or Personal Access Tokens (Bearer)
- **Deployment:** Google Cloud Run

## Running locally

### 1. Start Postgres

```bash
docker run --rm -d \
  --name tinkertask-pg \
  -e POSTGRES_DB=tinkertask \
  -e POSTGRES_USER=tinkertask \
  -e POSTGRES_PASSWORD=tinkertask \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Set up environment

From the `server/` directory:

```bash
cp .env.example .env
# Edit .env — fill in FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
# DATABASE_URL is pre-filled for the Docker container above
```

### 3. Install dependencies and migrate

```bash
pnpm install
pnpm run db:migrate
```

### 4. Start the dev server

```bash
pnpm run start:dev
```

The server listens on `http://localhost:8080`. All routes are prefixed `/v1`.

## Running tests

All tests require only a local Postgres instance via Testcontainers (pulled automatically).

```bash
# Unit tests (26 tests, no external dependencies)
pnpm run test

# End-to-end tests (40 tests, spins up a Postgres container)
pnpm run test:e2e

# Both
pnpm run test && pnpm run test:e2e
```

## Building and deploying

### Docker build (from repo root)

```bash
docker build -f server/Dockerfile -t tinkertask-backend .
```

### Deploy to Cloud Run

See `server/src/deploy/cloud-run-service.yaml` for the service manifest and
`server/DEPLOY.md` for the full step-by-step GCP deployment instructions.
