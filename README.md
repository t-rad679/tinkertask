# tinkertask

Monorepo for the tinkertask API-first task and habit tracker.

## Structure

- `server/` — NestJS + Drizzle backend (TypeScript). See `docs/superpowers/specs/2026-05-11-tinkertask-api-first-design.md` for design and `docs/superpowers/plans/2026-05-11-tinkertask-backend.md` for the implementation plan.
- `app/` — Flutter mobile client (planned separately; not yet scaffolded).
- `lib/` — **Shared language-neutral artifacts** (fixtures, grammar source, JSON Schemas) that both server and app consume. Not to be confused with `app/lib/`, which is the Flutter source convention.
- `docs/` — Specs and plans.
