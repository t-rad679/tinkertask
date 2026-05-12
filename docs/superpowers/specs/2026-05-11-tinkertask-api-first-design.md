# tinkertask — API-first / Dashboard-first Design

**Date:** 2026-05-11
**Status:** Draft (pending user review)
**Stage:** Design / Spec — precedes implementation planning
**Supersedes:** none. The prior `2026-05-09-tinkertask-design.md` (voice-first / mobile-first) is kept as a record of a different exploration.

---

## 1. Overview

tinkertask is a personal task and habit tracker with:

- A **Flutter mobile primary client** (iOS + Android).
- A **public-contract HTTP API** consumed by the mobile app, an Obsidian plugin (future), an MCP server (future), and any external voice agent (future).
- A **view-first** organization model — saved queries are the navigation primitive.
- A **Dashboard** as the daily landing surface, composed of user-pinned views.
- **User-typed hierarchical scopes** (you define the labels — `Project`, `Phase`, `Epic`, etc.) + free-form tags as the organization fields on a task.
- **Habits as counters** with optional per-day or per-week targets.

Built for one user (the author) with multi-device sync. Not designed for multi-tenancy.

### What changed vs. the prior design

The prior 2026-05-09 spec was voice-first: tap-and-hold to record audio, server-side STT + LLM parse, mobile-only capture. This design pivots:

- **Voice moves out of the primary app** to external agents (the planned MCP server, a separate voice agent process, etc.) that call the API.
- **No LLM in the server.** Natural-language parsing is replaced by a deterministic **capture syntax** (`pay rent #personal due:fri repeat:monthly/1`) parsed identically on server and client via shared fixtures. External agents — including voice agents — can either parse the syntax themselves or construct structured task JSON directly; the server holds neither STT nor LLM.
- **The API becomes the centerpiece** — a versioned, stable contract designed to support multiple clients from day one.
- **The organization model is the new core UX concern**, not voice capture. The user wanted Notion's flexibility + JIRA's expressiveness + Trello's manageability, none of which Notion's PAT template actually delivers.

## 2. v1 Scope

### In scope

- Tasks (one-shot + recurring) with user-typed hierarchical scopes (§4 `scope_types` + `scopes`) + free-form tags.
- Habits (kind=habit) with counter + optional per-day or per-week target.
- Completions table holding numeric `value` per completion (sum gives daily/weekly counter).
- **Views** (saved queries) — full CRUD; flat-JSON filter/sort/group representation.
- **Dashboards** composing user-pinned views in user-chosen order. Single dashboard per user in v1; schema future-proofs multiple.
- **Capture flow**: structured form + a "Quick parse" text input accepting the deterministic **capture syntax** (§8). Parser is identical on server and client (shared fixtures); in-app preview computed locally for zero-latency feedback. No LLM in the loop.
- **API as a public contract** — versioned (`/v1/...`), stable error envelope, cursor pagination, dual auth.
- **Auth**: Firebase ID tokens for the Flutter app; Personal Access Tokens for external clients.
- **Sign-up gate**: email allowlist enforced server-side; only emails on the list can create a user (see §12).
- **Per-user rate limits**: enforced (not just default) for abuse protection on a shared instance (see §7). `/v1/parse` has no special cost concern (no LLM) so it falls under the standard write/read caps.
- **Multi-device sync**: pull-based delta API + FCM silent-message sync hint (carried over from prior).
- **Local offline reads** + outbound write queue on the Flutter client.

### Explicit non-goals (v1)

- **No in-app voice capture.** No audio upload endpoint, no STT, no Cloud Storage audio bucket. External voice agents handle their own STT and either parse the syntax themselves or construct structured task JSON; they call `/v1/parse` + `/v1/tasks` or `/v1/tasks` directly.
- **No LLM anywhere in the server.** Parsing the user's capture utterance is a deterministic syntax parser, not a language model. External voice agents that *use* an LLM for STT or NL-to-syntax conversion live outside this design.
- **No Obsidian plugin** in this repo. The plugin is a separate project that consumes the API.
- **No MCP server** in this repo. Same: separate project.
- **No completion-over-time analytics or charts.** Counter/streak summaries on the habit detail screen are in scope; richer history visualizations are a stretch.
- **No collaboration / shared resources.** No way for two users to share a task, scope, or view; no assignees, watchers, comments, invites, permissions, teams, or workspaces. Adding this is a real future design pass (see §18). The data model *does* isolate users from each other via `user_id` on every table — friends with their own accounts on the same instance see only their own data. The allowlist + rate limits in §12 / §7 make a "shared instance with friends" mode operationally viable; collaboration features themselves are out of scope.
- **No conversational AI / chat-style queries** — that's an agent's job, not the app's.
- **No subtasks** distinct from scopes. Hierarchy is at the scope level (define a `Sub-task` scope-type if you want it).
- **No calendar integration** or time-blocking.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Flutter (iOS + Android)                                 │
│  • Dashboard, Views, Projects, Capture, Task Detail UI  │
│  • drift (SQLite) cache                                 │
│  • View-JSON → drift query compiler                     │
│  • Sync engine (pull deltas, push writes, LWW)          │
│  • Firebase Auth SDK + FCM SDK                          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS · Authorization: Bearer <Firebase ID token OR tt_pat_…>
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Cloud Run service (single container)                    │
│  • Auth middleware (Firebase verify OR PAT verify)      │
│  • /v1/parse  → deterministic syntax parser → ParsedTask │
│  • /v1/sync   → delta query                             │
│  • /v1/tasks, completions, scopes, scope_types, tags,   │
│    task_tags, views, dashboards, devices,               │
│    personal_access_tokens                               │
│  • FCM fanout on writes                                 │
└────────┬─────────────────────────────────────┬──────────┘
         ▼                                     ▼
┌──────────────┐                     ┌──────────────────┐
│ Cloud SQL    │                     │ Firebase Auth +  │
│ Postgres     │                     │ FCM              │
└──────────────┘                     └──────────────────┘
```

### Repository layout (monorepo)

Single git repo with three top-level directories:

```
tinkertask/                          # repo root
├── server/                          # NestJS backend (TypeScript)
│   ├── src/                         # all backend source (§11)
│   ├── test/                        # backend Jest tests
│   ├── package.json
│   ├── drizzle.config.ts
│   ├── Dockerfile
│   └── ...
├── app/                             # Flutter mobile client (Dart)
│   ├── lib/                         # Flutter source — Dart convention (§10)
│   ├── test/
│   ├── pubspec.yaml
│   └── ...
├── lib/                             # SHARED language-neutral artifacts
│   ├── fixtures/
│   │   ├── capture_syntax.json
│   │   ├── view_queries.json
│   │   └── recurrence.json
│   ├── grammar/
│   │   └── capture-syntax.peggy     # source of truth; server compiles directly,
│   │                                 # Dart parser re-implements the same grammar
│   └── schemas/
│       └── view-query.schema.json   # JSON Schema referenced by both implementations
├── docs/
│   └── superpowers/{specs,plans}/
└── README.md
```

**Important naming note:** the monorepo's `lib/` (at the repo root) is for cross-language shared artifacts. It is *not* the Flutter source dir — Flutter's convention puts its source at `app/lib/`. The two `lib/`s are unrelated; disambiguate by full path.

**No build-time coupling.** The server runs `pnpm` inside `server/`; Flutter runs `dart`/`flutter` inside `app/`. Neither cares about the other's tooling. Shared `lib/` artifacts are read at test time (fixtures) or build time (grammar template, schemas).

### Key architectural decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend | Flutter (iOS + Android) | Carried over. Voice handling no longer drives the choice, but Flutter still wins on the single-codebase + native-feel axis. |
| Local storage | SQLite via `drift` | Offline source of truth, type-safe queries, supports the view-JSON compile target. |
| Backend platform | Cloud Run | Carried over. Scales to zero, container-based. |
| Database | Cloud SQL for Postgres | Carried over. Relational fits the hierarchical-scopes + views model better than a document store. |
| Backend language | TypeScript | Strongest Firebase Admin SDK story, mature parser libraries for the capture syntax, shortest mental-model distance from Flutter/Dart. |
| Backend framework | NestJS (Express adapter) | Opinionated structure (modules / controllers / providers) keeps a solo-developer codebase coherent; built-in DI, validation pipes, guards, and config. |
| ORM / DB layer | Drizzle ORM | Type-safe, thin enough that the view-JSON → SQL compiler can drop to raw SQL when it needs to; native Postgres enum support (matches §4 enums); explicit migrations. Alternative: Prisma (more "magic," weaker fit for dynamic SQL composition). |
| Validation | `class-validator` + `class-transformer` | NestJS-idiomatic DTOs with declarative validation. |
| Auth integration | `firebase-admin` SDK + NestJS Guards | First-class Firebase Admin; a `FirebaseOrPatGuard` resolves the request's `user_id` regardless of token type (§7 / §12). |
| Capture-syntax parser | `peggy` (PEG.js successor) | Grammar lives in `lib/grammar/capture-syntax.peggy` (monorepo-shared); the server's parser is generated from it; the Dart parser in `app/` re-implements the same grammar by hand. CI runs both against `lib/fixtures/capture_syntax.json`. |
| Tests | Jest (NestJS default) + `pg-mem` or testcontainers for DB | Standard Nest testing pyramid. |
| FCM push | `firebase-admin/messaging` | Same SDK; reuses initialized Firebase app. |
| Sync | Pull-based delta + FCM silent push | Carried over. Eventually-consistent within seconds is what's actually needed. |
| Auth (primary) | Firebase Auth | Carried over for Flutter clients. |
| Auth (external) | Personal Access Tokens | New. PATs auth Obsidian, MCP, voice agent. User generates in app settings. |
| Capture parser | Deterministic syntax parser (no LLM) | Replaces the prior LLM call. Same parser implementation on server and client, validated against a shared fixture file. Zero per-call cost, zero latency, fully offline. |
| Push | FCM | Carried over. Silent data messages for sync hints. |

### What's *not* in the architecture (vs. prior)

- **No Cloud Speech-to-Text.** STT is the voice agent's problem.
- **No Cloud Storage audio bucket.** No audio touches the server.
- **No `/capture` endpoint.** Replaced by `/v1/parse` (now a deterministic syntax parser, not an LLM call).
- **No Vertex AI / Gemini.** No language model anywhere on the server. The capture pipeline is regex + grammar, deterministic, and tested via shared fixtures.
- **No `LLMProvider` abstraction.** Was a hedge against provider lock-in; no longer needed.

## 4. Data Model

### Enum types

Three closed value sets are declared as Postgres `ENUM` types rather than `text` with a CHECK constraint — type-safe storage, smaller on disk, and the migration tool surfaces value additions explicitly. The Drift client mirrors these as Dart enums via type converters; over the wire (JSON) they're plain strings.

```sql
CREATE TYPE task_kind       AS ENUM ('task', 'habit');
CREATE TYPE task_status     AS ENUM ('open', 'completed', 'archived');
CREATE TYPE device_platform AS ENUM ('ios', 'android');
```

Adding a value later uses `ALTER TYPE … ADD VALUE`. Anticipated future additions (noted, not made): `task_status` may grow `in_progress` or `snoozed`; `device_platform` may grow `web`, `macos` if Flutter desktop targets ship. `task_kind` is expected to stay binary.

Other discriminator fields (`tasks.target_period`, `recurrence.kind` inside the JSONB blob) stay as text for now: `target_period` because it lives in a column with a coupled constraint to `target_value`, and `recurrence.kind` because it lives inside JSONB where Postgres enum types don't apply.

### Postgres tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | text PK | Matches Firebase UID. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `scope_types`
User-defined labels that describe the organizational hierarchy. The user picks the words ("Project", "Phase", "Epic", "Initiative", "Sprint", …) and their relative order. Seeded on first launch with a single type `"Project"` (position 1) so the app isn't blank.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Indexed. |
| name | text | Singular label (`"Project"`, `"Phase"`). User-facing. |
| position | int | Hierarchy level. Lower position = higher in the tree (a position-1 type can be the parent of a position-2 type). Positions need not be contiguous (gaps are fine after a delete-and-reorder). |
| color | text null | Optional UI color (hex). |
| icon | text null | Optional emoji or icon key. |
| created_at | timestamptz | |
| updated_at | timestamptz | Sync delta basis. |
| deleted_at | timestamptz null | Tombstone. |

**Constraint:** unique `(user_id, lower(name)) where deleted_at is null` — case-insensitive uniqueness per user.

**Deletion is conservative:** `DELETE /v1/scope_types/:id` returns `409 scope_type_in_use` if any non-deleted `scopes` row references it. User must reassign or delete those scopes first. Avoids orphaned types.

**Indexes:**
- `(user_id, position) where deleted_at is null` — ordered listing.
- `(user_id, updated_at)` — sync delta.

#### `scopes`
Hierarchical organizational containers (renamed from `projects` so the user can call them whatever the `scope_types` row says). A scope is "an instance of a scope-type" — e.g., a `Project` named "Q2 Initiative" is a `scopes` row whose `scope_type_id` points at the `Project` row in `scope_types`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Indexed. |
| scope_type_id | uuid FK→scope_types.id | Which type this scope is (`Project`, `Phase`, etc.). |
| parent_id | uuid null FK→scopes.id | Null = root scope. |
| name | text | |
| color | text null | Optional UI color (hex). |
| icon | text null | Optional emoji or icon key. |
| created_at | timestamptz | |
| updated_at | timestamptz | Sync delta basis. |
| deleted_at | timestamptz null | Tombstone. |

**Hierarchy constraint (ordered, level-skipping allowed):** on insert / update, the server validates that `parent.scope_type.position < this.scope_type.position`. So if types are `Project (1) > Phase (2) > Sub-phase (3)`, a `Sub-phase` may have either a `Project` or a `Phase` as its parent, but never another `Sub-phase` or a downward-pointing parent. Violations → `400 invalid_scope_hierarchy` with `details.reason`.

**Sibling uniqueness:** unique `(user_id, parent_id, lower(name)) where deleted_at is null`. So you can have two scopes named "Build" — one inside Project "Web", one inside Project "Mobile" — but not two "Build" scopes with the same parent.

**Cascade rule:** On `DELETE /v1/scopes/:id`, the server, in a single transaction:
1. Sets `scopes.deleted_at = now()` on the target scope.
2. Sets `scope_id = null, updated_at = now()` on every task previously pointing to it (so the change appears in sync deltas; clients don't have to dereference tombstoned scopes).
3. Recursively tombstones every descendant scope (cascade tombstone, not cascade delete) and applies step 2 to their tasks.

Tasks are never deleted as a side-effect of scope deletion — they become scope-less.

**Practical depth limit:** the *implicit* nesting limit is the number of scope types the user has defined. With three types defined, you can nest up to three levels. The UI doesn't impose an additional cap; if the user defines 8 types, 8-level nesting is allowed.

**Task attachment:** A task can be attached to a scope at **any** level (leaf or non-leaf, any type) — like JIRA epics can have direct issues.

**Indexes:**
- `(user_id, parent_id) where deleted_at is null` — children-of-parent lookup.
- `(user_id, scope_type_id) where deleted_at is null` — "all scopes of this type" queries.
- `(user_id, updated_at)` — sync delta.

#### `tasks`
Holds both tasks and habits (`kind` discriminator). Carries optional `target_value` + `target_period` for habits.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Indexed. |
| scope_id | uuid null FK→scopes.id | Null = no scope. |
| title | text | |
| body | text | Optional freeform notes. |
| kind | task_kind | `'task'` or `'habit'`. |
| status | task_status | `'open'`, `'completed'`, `'archived'`. Habits and recurring tasks stay `'open'`; per-occurrence completion lives in `completions`. Only one-shot tasks (recurrence is null) transition to `'completed'`. |
| due_at | timestamptz null | Date a one-shot task is due. Null for habits and undated tasks. |
| recurrence | jsonb null | Recurrence rule (see §4.x). Null for one-shot. |
| target_value | int null | Habit target. Null means "no target" (free counter). Boolean habits use `target_value = 1`. |
| target_period | text null | `'day'`, `'week'`, or null. Defines the window over which `value` sums must reach `target_value`. Null when `target_value` is null. |
| created_at | timestamptz | |
| updated_at | timestamptz | Sync delta basis. |
| completed_at | timestamptz null | For one-shot tasks only. |
| deleted_at | timestamptz null | Tombstone. |

**Constraint:** `(target_value IS NULL) = (target_period IS NULL)` — both set or both null.

**Indexes:**
- `(user_id, updated_at)` — sync delta.
- `(user_id, scope_id) where deleted_at is null` — scope view.
- `(user_id, kind) where deleted_at is null` — habits-only queries.
- `(user_id, status) where deleted_at is null` — open-tasks queries.

Tag-based filtering is served by the `task_tags` join table (see below), not by a column on `tasks`.

#### `tags`
Tags are first-class rows (not a `text[]` on tasks) so the client can typeahead them from a synced local cache, the user can rename or recolor them in one operation, and queries filter by stable IDs.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Indexed. |
| name | text | User-facing label ("work", "errand"). |
| color | text null | Optional UI color (hex). |
| use_count | int default 0 | Maintained by application on tag attach/detach. Used for ordering the typeahead dropdown. |
| created_at | timestamptz | |
| updated_at | timestamptz | Sync delta basis. |
| deleted_at | timestamptz null | Tombstone. |

**Constraint:** unique `(user_id, lower(name)) where deleted_at is null` — case-insensitive uniqueness per user. Re-tagging with a different case ("Work" vs "work") reuses the existing row.

**Indexes:**
- `(user_id, lower(name)) where deleted_at is null` — typeahead and uniqueness.
- `(user_id, updated_at)` — sync delta.

**Cascade rule:** On `DELETE /v1/tags/:id`, the server, in a single transaction:
1. Sets `tags.deleted_at = now()` on the target tag.
2. Sets `task_tags.deleted_at = now(), updated_at = now()` on every `task_tags` row pointing to it (so tag removal propagates via sync deltas).
3. Bumps `tasks.updated_at = now()` on every task that had the tag (so dependent task views refresh).

#### `task_tags`
Join table between `tasks` and `tags`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Denormalized for fast scans + sync delta. |
| task_id | uuid FK→tasks.id | |
| tag_id | uuid FK→tags.id | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz null | Tombstone (tag removed from task). |

**Constraint:** unique `(task_id, tag_id) where deleted_at is null` — a tag can only be attached to a task once. (After a soft-delete it's allowed to re-attach.)

**Indexes:**
- `(user_id, updated_at)` — sync delta.
- `(task_id) where deleted_at is null` — "tags for this task" lookup.
- `(tag_id) where deleted_at is null` — "tasks with this tag" lookup; also used for view-query tag filters.

#### `completions`
One row per habit/recurring-task completion event. The `value` column generalizes the prior design's boolean into a counter increment.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Denormalized for fast scans. |
| task_id | uuid FK→tasks.id | |
| completed_on | date | The day this counts for. |
| value | int default 1 | Increment amount. Sum per day = daily counter; sum per ISO week = weekly counter. |
| notes | text null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz null | Tombstone (un-complete). |

**"Is the habit done today?"** depends on `tasks.target_value` + `tasks.target_period`:
- `target_value = NULL` → no "done" state; just track totals.
- `target_period = 'day'` → done when `SUM(value) FROM completions WHERE task_id = X AND completed_on = today AND deleted_at IS NULL >= target_value`.
- `target_period = 'week'` → same but over the current ISO week.

**Indexes:**
- `(user_id, updated_at)` — sync delta.
- `(task_id, completed_on)` — habit detail / daily aggregation.
- No unique constraint on `(task_id, completed_on)` — multiple completions per day are valid (e.g., logging 5 push-ups four times across a day).

#### `views`
A saved query.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | |
| name | text | |
| query | jsonb | Filter/sort/group/display JSON (see §5). |
| icon | text null | |
| color | text null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz null | Tombstone. |

**Indexes:**
- `(user_id, updated_at)` — sync delta.

#### `dashboards`
One dashboard per user in v1; schema admits multiple.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | |
| name | text | Default `"Dashboard"`. |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz null | Tombstone. |

#### `dashboard_views`
Ordered join: which views are pinned to which dashboard.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dashboard_id | uuid FK→dashboards.id | |
| view_id | uuid FK→views.id | |
| position | int | Display order. |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz null | Tombstone (unpin). |

**Unique:** `(dashboard_id, view_id) where deleted_at is null`.

#### `personal_access_tokens`
For external clients (Obsidian, MCP, voice agent).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | |
| name | text | User-facing label ("Obsidian — laptop"). |
| token_hash | text | `bcrypt(tt_pat_...)`. Plaintext returned only at creation. |
| last_used_at | timestamptz null | Bumped on every successful auth. |
| created_at | timestamptz | |
| revoked_at | timestamptz null | Soft revoke. |

**Token format:** `tt_pat_` + 32 random bytes base64url-encoded.
**Server lookup:** Token presented → server hashes → indexed lookup on `token_hash`.

#### `devices`
Carried over from prior design.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | |
| fcm_token | text | |
| platform | device_platform | `'ios'` or `'android'`. |
| last_seen_at | timestamptz | |
| created_at | timestamptz | |

### Recurrence JSONB shape

Carried over from prior:

```json
{
  "kind": "daily" | "weekdays" | "weekly" | "monthly" | "every_n_days",
  "byweekday": [0, 2, 4],
  "byday": 1,
  "every": 3
}
```

`daily` no extras · `weekdays` no extras (Mon–Fri) · `weekly` uses `byweekday` (0=Mon … 6=Sun) · `monthly` uses `byday` (1–28) · `every_n_days` uses `every`.

"Next due date" is derived from `recurrence` + `created_at` + most-recent `completed_on`. Both server and client compute this deterministically. A shared fixture file (input → expected next_due) anchors both implementations.

## 5. View Query Model

A view's `query` column stores a **flat JSON** filter/sort/group representation. AND-of-filters is implicit; OR-across-fields is not expressible in v1 (workaround: pin multiple views to the dashboard).

```jsonc
{
  "filter": {
    "kind":   ["task", "habit"],                                  // any-of; absent = all kinds
    "scope": { "id": "uuid|null", "include_descendants": true },   // id=null means "tasks with no scope"
    "scope_type": ["scope-type-uuid-1"],                            // any-of; filter tasks whose scope is of one of these types (or directly the type if no scope_id given)
    "tags":   { "all": ["tag-uuid-1"], "any": ["tag-uuid-2", "tag-uuid-3"], "none": false },
                                                                   // all/any are AND-combined arrays of tag IDs (not names)
                                                                   // "all": [] and "any": [] (omitted or empty) mean "no tag constraint"
                                                                   // "none": true filters to untagged tasks (overrides all/any)
    "status": ["open"],                                            // any-of; absent = all statuses
    "due":    { "preset": "today" | "overdue" | "overdue_or_today" | "this_week" | "this_month" | null,
                "before": "2026-05-15T00:00:00Z",
                "after":  "2026-05-10T00:00:00Z" },
                                                                   // if "preset" is non-null, it wins; before/after ignored
    "recurrence": "any" | "none" | null,                           // null = either
    "search": "free text"                                          // case-insensitive title+body
  },
  "sort":  [{ "field": "due_at" | "title" | "created_at" | "updated_at" | "scope",
              "dir": "asc" | "desc" }],
  "group": "due" | "scope" | "scope_type" | "kind" | "status" | "none",
  "display": { "show_completed": false, "compact": true }
}
```

### Validation and execution

- **Server validates** the JSON against a strict schema. Unknown fields are rejected (forces forward-only evolution).
- **Server compiles** to a parameterized SQL query (tag filters compile to joins/anti-joins against `task_tags`).
- **Client compiles** the same JSON to a drift query against the local SQLite cache.
- A **shared fixture file** (`fixtures/view_queries.json`) lists canonical query inputs and expected result row IDs against a canonical seed dataset. Both server and client must produce identical results. This is the spec for "view query semantics."

### Tag IDs vs. names in stored queries

View queries reference **tag IDs**, not names. This makes views robust against tag renames — a stored view filtering by `["tag-uuid-1"]` keeps working when the user renames "work" to "career." The view editor UI handles name ↔ ID translation: shows tag names in chips, stores IDs in the JSON. Agent-authored views go through the same UI / API path: any endpoint that accepts a view body resolves tag names → IDs server-side before storing.

### Evolution path

If we later need OR-across-fields, upgrade by treating today's flat JSON as syntactic sugar over an implicit AND-tree, and add an optional `"any_of"` array of sub-filters. No breaking change to existing stored queries.

### Built-in views

The Flutter app seeds three views on first launch and pins them to the user's dashboard. These are normal `views` rows, editable by the user:

1. **Habits today** — `{ filter: { kind: ["habit"] } }`. Rendered as a habit-flavored card (see §6 and §10) — the dashboard widget applies the "should I surface this habit today?" aggregator on top of the filter result.
2. **Right now** — `{ filter: { kind: ["task"], status: ["open"], due: { preset: "overdue_or_today" } }, sort: [{ field: "due_at", dir: "asc" }] }`.
3. **This week** — `{ filter: { kind: ["task"], status: ["open"], due: { preset: "this_week" } }, sort: [{ field: "due_at", dir: "asc" }] }`.

## 6. Habit Semantics in Detail

A habit's "should I show this on the dashboard today?" rule. ("Show" here means surface in the dashboard's habit-flavored view card; the underlying view query returns all habits, and the card applies the aggregator below.)

- `target_value = NULL` (free counter): show every day. No "done" badge — just a `+N` chip and today's count.
- `target_period = 'day'`: show if `SUM(today.value) < target_value`, gated by `due_today_per_recurrence`. Mark "done" when target met. After reached, hide from dashboard for the rest of today (still visible in habit detail).
- `target_period = 'week'`: show every day of the current ISO week while `SUM(this_week.value) < target_value`, regardless of `recurrence` (weekly targets typically have `recurrence = null`). Mark "done" when target met; hide for the rest of the week.

`due_today_per_recurrence` is the derived "is this habit scheduled for today based on its recurrence rule?" predicate, evaluated client-side using the shared `recurrence` logic.

The UI offers three completion gestures, per habit type:

- Boolean (target=1): tap the row checkbox → POST completion with `value=1`.
- Counter with target (e.g., 30/50 push-ups): tap a `+N` chip (configurable default; user picks N) → POST completion with `value=N`. Long-press for arbitrary number entry.
- Free counter (no target): same `+N` chip, no progress bar.

**Streaks** are derived from `completions`: the longest unbroken run of "target met" days (for daily targets) or weeks (for weekly targets) ending at today / this-week. Computed on the client; not stored.

## 7. API Surface

All endpoints prefix `/v1/`. All return JSON. All require `Authorization: Bearer <token>`.

### Auth resolution

The middleware tries, in order:

1. If the token starts with `tt_pat_` → PAT lookup.
2. Otherwise → Firebase Admin SDK `verifyIdToken()`.

Both resolve to a `user_id`. Downstream handlers are auth-agnostic.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/parse` | Body `{ text: string }` (capture syntax, ≤ 2,000 chars). Returns `ParsedTask` (no DB write). Deterministic; same parser as the client (shared fixtures). Returns `400 parse_failed` with `details.position` on invalid syntax. |
| GET | `/v1/sync?since=<ISO ts>&cursor=<c>` | Returns rows changed since `<ts>` across `tasks`, `completions`, `scopes`, `scope_types`, `tags`, `task_tags`, `views`, `dashboards`, `dashboard_views`, `devices`. Includes a `now` field for the next `since`. Cursor-paginated. |
| POST | `/v1/tasks` | Create a task or habit. Body MAY include `tags: ["string"]` (names — server resolves to existing tags or creates new ones, case-insensitive); the server creates the corresponding `task_tags` rows atomically. |
| PATCH | `/v1/tasks/:id` | Partial update. If `tags` is present, it's treated as a full replacement: server diffs against current `task_tags`, soft-deletes removed entries, creates new ones. Omitting `tags` from the patch leaves tag attachments untouched. |
| DELETE | `/v1/tasks/:id` | Soft delete (also cascade-tombstones the task's `task_tags` rows). |
| POST | `/v1/completions` | Body includes `task_id`, `completed_on`, optional `value` (default 1), optional `notes`. |
| PATCH | `/v1/completions/:id` | Edit `value` or `notes`. |
| DELETE | `/v1/completions/:id` | Soft delete (un-complete). |
| POST | `/v1/scopes` | Create a scope. Body: `{ scope_type_id, name, parent_id?, color?, icon? }`. Server validates the hierarchy constraint and returns `400 invalid_scope_hierarchy` if `parent.scope_type.position >= scope_type.position`. |
| PATCH | `/v1/scopes/:id` | Partial update. Can move (`parent_id`) or re-type (`scope_type_id`); both re-validate the hierarchy constraint against the new parent / new type, and against the types of any descendants (server walks the subtree). |
| DELETE | `/v1/scopes/:id` | Soft delete. Tasks become scope-less; sub-scopes cascade-tombstone. |
| GET | `/v1/scope_types` | List the user's scope types, ordered by `position`. |
| POST | `/v1/scope_types` | Create. Body: `{ name, position, color?, icon? }`. Name case-insensitive unique per user. |
| PATCH | `/v1/scope_types/:id` | Update name / position / color / icon. Changing `position` re-validates: server walks every `scopes` row of this type and confirms its parent and descendants still satisfy the hierarchy constraint; if not, returns `409 reorder_breaks_hierarchy` with the offending scope IDs. |
| DELETE | `/v1/scope_types/:id` | Soft delete. Returns `409 scope_type_in_use` if any non-deleted scope still uses this type. |
| POST | `/v1/tags` | Create a tag. Body `{ name, color? }`. Case-insensitive uniqueness per user. |
| PATCH | `/v1/tags/:id` | Rename / recolor. Tag IDs remain stable; view queries are unaffected. |
| DELETE | `/v1/tags/:id` | Soft delete. Cascade-tombstones all `task_tags` rows; bumps dependent tasks' `updated_at`. |
| POST | `/v1/tasks/:id/tags` | Attach a tag to a task. Body `{ tag_id }` OR `{ name }` (server resolves/creates). Idempotent (re-attaching an attached tag is a no-op; un-tombstoning a previously-removed `task_tags` row counts as a no-op success). |
| DELETE | `/v1/tasks/:id/tags/:tag_id` | Detach a tag from a task (soft-delete the `task_tags` row). |
| POST | `/v1/views` | Create a view. Body includes `name`, `query` JSON. |
| PATCH | `/v1/views/:id` | Update. |
| DELETE | `/v1/views/:id` | Soft delete. |
| POST | `/v1/views/:id/run?cursor=<c>` | Execute a saved view's query. Paginated. |
| POST | `/v1/views/run` | Execute an inline (unsaved) query — for "build a view" preview. |
| POST | `/v1/dashboards` | Create a dashboard. (v1 seeds one for the user automatically.) |
| PATCH | `/v1/dashboards/:id` | Rename. |
| DELETE | `/v1/dashboards/:id` | Soft delete. |
| POST | `/v1/dashboards/:id/views` | Pin a view. Body `{ view_id, position }`. |
| PATCH | `/v1/dashboards/:id/views/:view_id` | Reorder (update position). |
| DELETE | `/v1/dashboards/:id/views/:view_id` | Unpin. |
| POST | `/v1/devices` | Register/update an FCM token. |
| DELETE | `/v1/devices/:id` | Deregister (on sign-out). |
| GET | `/v1/personal_access_tokens` | List PATs (name, last_used_at, created_at). |
| POST | `/v1/personal_access_tokens` | Generate a new PAT. Returns plaintext token **once**. |
| DELETE | `/v1/personal_access_tokens/:id` | Revoke. |

### Error envelope

```json
{ "error": { "code": "string_code", "message": "human readable", "details": {} } }
```

Stable codes documented (e.g., `invalid_query`, `invalid_recurrence`, `not_found`, `forbidden`, `rate_limited`, `parse_failed`, `llm_unavailable`). HTTP status mirrors severity (400/401/403/404/422/429/500/503).

### Pagination

Cursor-based on every list endpoint and on `/v1/sync` and `/v1/views/:id/run`. Response includes `next_cursor` (null when exhausted).

### Client headers on writes

Every write request (POST/PATCH/DELETE) from a client SHOULD include `X-Device-Id: <device-uuid>`. The server uses this to exclude the originating device from the FCM sync-hint fanout (§9). Absent header → server skips fanout entirely on that write (the writing client is responsible for refreshing its own state via the API response).

### Rate limiting

Per-user, enforced by the auth middleware (not just configured defaults — actual 429 responses when exceeded). Counters are per-`user_id`, per-endpoint-class, per-rolling-minute window. Stored in process memory in v1 (single Cloud Run instance / sticky); if/when we scale to multiple instances, move to Redis or Cloud Memorystore.

Default caps:
- **Read endpoints** (`GET /v1/sync`, `GET /v1/personal_access_tokens`, list-runs): 600 req/min/user.
- **Write endpoints** (POST/PATCH/DELETE on tasks, completions, scopes, scope_types, tags, task_tags, views, dashboards, dashboard_views, devices): 120 req/min/user.
- **`/v1/parse`**: falls under the read endpoint cap (no LLM, no cost concern).
- **`/v1/personal_access_tokens` POST** (PAT creation): 10 req/hour/user.

Over the cap → 429 with the standard error envelope and `Retry-After` header. Codes: `rate_limited_read`, `rate_limited_write`, `rate_limited_pat_create`.

Caps are tunable via env var without redeploy. The above are starting defaults sized for a small group of friends sharing one instance — if you're the only user, you'll never hit them.

## 8. Capture Flow

### In-app

1. User taps **+ Capture** on the bottom nav (or the FAB on Dashboard).
2. Modal opens with two coupled surfaces:
   - A **Quick parse** text field at the top — user types the capture syntax (see §8.1).
   - The **structured form** below: kind (Task/Habit toggle), title, scope, due, repeats, tags, target. Habit kind reveals target value + period fields. The scope picker is a typeahead over the user's `scopes` table; the scope row in the result shows the scope's name with a small chip of its scope-type name ("Q2 Initiative · Project").
3. As the user types in the Quick parse field, the **client-side parser** runs on every keystroke and live-updates the form fields below. Invalid syntax shows a small underline + a one-line hint ("expected `due:<date>` after `due:`"). No server roundtrip during typing.
4. The user can ignore Quick parse entirely and just fill the form — both produce the same `ParsedTask` shape internally.
5. **Create** → POST `/v1/tasks` with the structured fields (tag *names*, scope *path*, etc.; server resolves to IDs) → returns task → close modal → optimistic dashboard refresh.

The "✨" iconography from the prior LLM-flavored design is dropped — the button is just "Quick parse" with a plain typewriter / keyboard icon.

### External agents (voice / MCP / Obsidian / etc.)

External clients have two paths to call write a task:

- **Path A (syntax):** Construct a capture-syntax string. Either POST `/v1/parse` to validate and get back a `ParsedTask`, then POST `/v1/tasks` with the structured fields; or skip the round-trip and POST `/v1/tasks` directly with the structured fields.
- **Path B (structured):** Build the structured task payload directly and POST `/v1/tasks`. This is the recommended path for MCP tools (`create_task(title, due, ...)`) and for voice agents that already use an LLM client-side to interpret speech — they emit structured JSON, skipping the syntax entirely.

There is no NL-to-syntax converter on the server. A voice agent that wants natural-language input (the user says "remind me to pay rent on the first of every month") owns the conversion itself, either via a small in-agent LLM or via a syntax-prompting flow.

### `/v1/parse` contract

- Input: `{ text: string }` — a single capture-syntax string, ≤ 2,000 chars.
- Output: `ParsedTask`:

```json
{
  "title": "string",
  "body": "string | null",
  "kind": "task | habit",
  "due_at": "ISO-8601 datetime | null",
  "recurrence": { "kind": "...", "byweekday": "[int]|null", "byday": "int|null", "every": "int|null" } | null,
  "target_value": "int | null",
  "target_period": "day | week | null",
  "tags": ["string"],
  "scope": "string | null"
}
```

- `scope` is the raw token string the user typed (a name or `parent/child` path). The server resolves it to a `scope_id` at task-create time; if resolution fails, `POST /v1/tasks` returns `404 scope_not_found` and the caller can either let the user fix it or auto-create the scope (with a default scope-type, typically the user's lowest-position type — see open Q in §18).
- Deterministic parser; no model, no retries, no timezone surprises. The user's timezone (resolved from the authenticated `users` row, defaulted to UTC if unset) is used to resolve relative dates like `due:tomorrow` and weekday names.
- On invalid input → `400 parse_failed` with `details.position` pointing at the character offset of the first error and `details.message` describing what was expected.
- Server and client run **the same parser** validated against `fixtures/capture_syntax.json` (canonical input strings → canonical `ParsedTask` outputs). CI fails if either implementation diverges from the fixtures.

### 8.1 Capture syntax grammar

The capture syntax is a single line with a free-text **title** followed by zero or more **modifier tokens**, each whitespace-separated. Modifiers can appear in any order. The title is everything from the start of the input up to (but not including) the first whitespace-separated token that is recognized as a modifier.

#### Modifier tokens

| Token | Effect | Example |
|---|---|---|
| `#<name>` | Adds tag `<name>` (multiple allowed). Case-insensitive match against existing tags; otherwise created on save. | `#personal` |
| `@<path>` | Sets the scope. Path is `name` or `parent/child/grandchild` for nested. Case-insensitive lookup. Matches the unique scope at that path (sibling uniqueness guarantees one result if the path is fully qualified). A bare `@<name>` works only if the name is unique across all scopes; otherwise the parser returns `400 ambiguous_scope`. | `@work` or `@work/q2/build` |
| `habit` | Marks kind=habit. Default for bare `habit`: `target_value=1, target_period=day` (boolean daily habit). Override with `target:`. | `meditate habit` |
| `due:<date>` | Sets `due_at`. See date grammar below. Only valid for tasks (kind=task). | `due:fri` |
| `repeat:<rule>` | Sets `recurrence`. See recurrence grammar below. | `repeat:monthly/1` |
| `target:<spec>` | Sets habit target. `<spec>` is `<int>/<period>` (e.g. `50/day`, `3/week`) or `none` for free counter. Implies `habit`. | `target:50/day` |
| `note:"<text>"` or `-- <text>` | Sets `body`. `note:` accepts a quoted string; `--` consumes everything to the end of input. | `note:"call by 5pm"` |

#### Date grammar (`due:<date>`)

| Form | Resolves to |
|---|---|
| `today` | today (00:00 in user's TZ) |
| `tomorrow` | today + 1 day |
| `mon` / `tue` / `wed` / `thu` / `fri` / `sat` / `sun` | next occurrence of that weekday (≥ 1 day from now; never today) |
| `in/<int>(d\|w\|m)` | today + N days / weeks / months. `in/3d`, `in/2w`, `in/1m` |
| `YYYY-MM-DD` | absolute date, 00:00 in user's TZ |
| `YYYY-MM-DDTHH:MM` | absolute date-time, user's TZ |

#### Recurrence grammar (`repeat:<rule>`)

| Form | Maps to recurrence JSONB |
|---|---|
| `daily` | `{ kind: "daily" }` |
| `weekdays` | `{ kind: "weekdays" }` |
| `weekly/<days>` | `{ kind: "weekly", byweekday: [...] }` — days is comma-separated `mon,wed,fri` |
| `monthly/<N>` | `{ kind: "monthly", byday: N }` — N in 1–28 |
| `every/<N>d` | `{ kind: "every_n_days", every: N }` |

#### Examples (round-trip with the parser)

| Input | Output (abbreviated) |
|---|---|
| `pay rent` | task, title="pay rent" |
| `pay rent due:fri` | task, title="pay rent", due_at=Friday |
| `pay rent #bills @personal due:2026-05-15` | task, title="pay rent", tags=["bills"], scope="personal", due_at=2026-05-15 |
| `pay rent repeat:monthly/1` | task, title="pay rent", recurrence={kind:monthly, byday:1} |
| `reply to sarah due:in/3d -- mention the budget` | task, title="reply to sarah", due_at=today+3d, body="mention the budget" |
| `meditate habit` | habit (boolean daily), title="meditate", target=1/day |
| `meditate habit repeat:weekdays` | habit (boolean), title="meditate", recurrence=weekdays |
| `push-ups habit target:50/day` | habit (counter), title="push-ups", target=50/day |
| `workout habit target:3/week` | habit (weekly counter), title="workout", target=3/week |
| `read 20min habit target:none repeat:daily #personal` | habit (free counter), title="read 20min", target=null, recurrence=daily, tags=["personal"] |

#### Edge cases and parser rules

- **Title boundary:** title ends at the first whitespace-separated token whose first character is `#`, `@`, or which matches a known keyword (`habit`, `due:`, `repeat:`, `target:`, `note:`, `--`). Title is trimmed.
- **Literal `#` or `@` in title:** prefix with backslash (`\#`, `\@`).
- **Case-insensitive** keyword recognition; case is preserved in title and `note:` body.
- **Conflicts:** `target:` implies `habit`; if the input has `target:` without `habit`, parser treats it as habit. If the input has `habit` AND a task-only modifier like `due:` (one-shot due date), the parser rejects with `400 parse_failed`. (Habits can have `repeat:`, but not `due:`.)
- **Whitespace in tag / scope names:** not supported; use `-` or `_`.
- **Multiple `due:` or `repeat:`:** last-write-wins (no error). Multiple `#tag` modifiers accumulate.
- **Multi-line input:** invalid in v1; the parser rejects any input containing `\n`.

## 9. Sync Mechanism

Carried over from prior design, broadened to cover new entities.

### Endpoints

- `GET /v1/sync?since=<ts>&cursor=<c>` returns all rows from `tasks`, `completions`, `scopes`, `scope_types`, `tags`, `task_tags`, `views`, `dashboards`, `dashboard_views`, `devices` where `updated_at > since` OR `deleted_at > since`. Includes `now` and `next_cursor`.

### Client-side sync engine

Holds a `last_synced_at` value in SQLite. Calls `/v1/sync` on:

- App foreground.
- Pull-to-refresh.
- Receipt of an FCM data message with `type: "sync_hint"`.
- After every successful local write to the server.

Applies deltas with LWW per row. Sets `last_synced_at = response.now` on completion.

### Outbound writes

Every local mutation enqueues to a write-queue SQLite table. A background worker drains the queue (POST/PATCH/DELETE). On success: dequeue and overwrite local with server response. On network failure: retain and retry with exponential backoff. UI reads from local DB, so writes are visible immediately.

### Conflict handling

LWW per row, server `updated_at` authoritative. Tombstones beat live rows. Acceptable because one user is editing at a time.

### FCM fanout

On server-side write to any synced entity, push a silent FCM data message `{ "type": "sync_hint" }` to every device in `devices` except the originating device. Origin is identified by the `X-Device-Id` header on the write request (§7); when absent, the server skips fanout for that write.

## 10. Mobile App Structure

### Screens

- **Dashboard** — primary landing. Stack of pinned view cards in order. Each card runs its view's query and renders rows. The renderer chooses card type from the view's filter: if `filter.kind = ["habit"]` (habit-only view), it renders a habit-flavored card with `+N` chips, progress bars, streaks, and applies the §6 habit aggregator on top of the filter result. Otherwise it renders a task-flavored card with check-off rows. "+ Pin a view" affordance at the bottom. FAB for capture.
- **All Views** — list of saved views with edit/pin/duplicate/delete actions. "+ New view" launches the view editor.
- **View Detail** — runs the view's query and shows results in full. Header is the view name + a "Edit query" button.
- **View Editor** — filter chips (kind, scope, scope-type, tags, status, due), sort selector, group selector, display toggles. Live preview of result count.
- **Scopes** — scope tree browser. Tap a scope → see its tasks (scope-detail view). Header shows the scope-type chip; "+ New scope" prompts for type.
- **Scope Detail** — list of tasks in this scope (and optionally its descendants — toggle).
- **Scope Types** — settings sub-screen for managing the user's scope-type vocabulary: list with position drag-handles, add/rename/recolor, delete (blocked if any scope uses the type).
- **Capture** — modal as described in §8. The tag field has a typeahead dropdown sourced from a local drift query against the synced `tags` table (`SELECT id, name, color FROM tags WHERE user_id = ? AND lower(name) LIKE ? AND deleted_at IS NULL ORDER BY use_count DESC LIMIT 10`). New tag names not yet in the table are offered as "+ Create 'foo'" inline; on task save, the server creates them.
- **Task Detail** — editable title, body, scope, due, recurrence, tags, status, target (if habit).
- **Habit Detail** — task detail screen plus current/longest streak, total completions, year heatmap (carried over from prior).
- **Settings** — auth (sign in/out), PAT management, device list, "About."

### Navigation

Bottom tab bar: **Dashboard · Views · Projects · Capture**. (Capture is a modal trigger, not a navigation destination — but it occupies the rightmost tab slot for thumb-reachable access.)

### State management

Riverpod. Repository layer wraps drift; providers stream rows / view query results to the UI. The view-JSON → drift compiler lives in `lib/query/` and is the analog of the server's SQL compiler.

### Key Flutter packages

- `drift` — SQLite ORM.
- `firebase_core`, `firebase_auth`, `firebase_messaging`.
- `dio` (or `http`) — networking.
- `riverpod` / `flutter_riverpod` — state.
- `intl` — date / timezone.
- *(No `record` package — audio is gone.)*

### Module layout

Located under `app/lib/` in the monorepo (the Flutter `lib/` convention — distinct from the repo-root `lib/` which holds shared artifacts).

```
app/lib/
  ui/
    dashboard/
    views/
    scopes/           — scope tree browser, scope detail, scope picker
    scope_types/      — scope-type management (within settings)
    tags/             — tag manager screen + tag-picker widget (typeahead)
    capture/
    task_detail/
    habit_detail/
    settings/
  data/             — drift schema (includes scopes, scope_types, tags, task_tags), DAOs, repositories
  query/            — view-JSON → drift query compiler; verified against ../../lib/fixtures/view_queries.json
  syntax/           — pure-Dart capture-syntax parser; verified against ../../lib/fixtures/capture_syntax.json
  sync/             — sync engine, write queue
  api/              — HTTP client, DTOs
  auth/             — Firebase Auth wrapper
  notifications/    — FCM handler
  recurrence/       — pure-Dart recurrence + target-period logic; verified against ../../lib/fixtures/recurrence.json
```

## 11. Backend Module Layout

NestJS modules, each owning its controller, service, and (where relevant) DTO + DB schema slice. Drizzle schema and migrations live in `server/src/db/`. The dual-implemented logic (parser, query compiler, recurrence) lives in `server/src/shared/` for clarity, with shared fixtures and grammar pulled from the repo-root `lib/`.

```
server/src/
  main.ts                  — Nest bootstrap, global pipes, exception filter
  app.module.ts            — root module wiring

  auth/                    — module
    firebase-or-pat.guard.ts
    auth.service.ts        — token verify, user_id resolution, PAT hash lookup
    auth.module.ts

  users/                   — module (just user row management + allowlist check)
  tasks/                   — module (controller + service + DTOs)
  completions/
  scopes/                  — module (CRUD + hierarchy validator)
  scope-types/             — module (CRUD + reorder/delete safety)
  tags/                    — module (CRUD + use_count maintenance)
  views/                   — module (CRUD + run; uses shared/query/)
  dashboards/              — module
  devices/                 — module
  personal-access-tokens/  — module
  parse/                   — /v1/parse controller, thin wrapper around shared/syntax/
  sync/                    — /v1/sync controller, delta query

  shared/
    syntax/                — capture-syntax parser (peggy grammar + compiled output)
    query/                 — view-JSON → Drizzle SQL compiler
    recurrence/            — next-due + target-period logic
    fcm/                   — FCM fanout helper
    rate-limit/            — in-process per-user counters (§7)

  db/
    schema.ts              — Drizzle table definitions (mirrors §4)
    migrations/            — generated Drizzle migrations
```

Three pieces of logic are dual-implemented (server + client) and pinned by shared fixtures at the repo root: the **capture-syntax parser** (`lib/fixtures/capture_syntax.json`), the **view-query compiler** (`lib/fixtures/view_queries.json`), and the **recurrence next-due / target-period logic** (`lib/fixtures/recurrence.json`). CI runs both implementations against each fixture and fails on divergence. Server reads them in Jest via `path.join(__dirname, '..', '..', 'lib', 'fixtures', ...)`; Flutter reads them via a relative test asset path.

## 12. Auth & Security

### Auth model recap

- **Flutter app** → Firebase Auth (email link, Apple, Google) → Firebase ID token in `Authorization: Bearer ...`.
- **External clients** (Obsidian plugin, MCP server, voice agent) → PAT in `Authorization: Bearer tt_pat_...`.

### PAT lifecycle

- **Create**: user in app settings taps "+ New token", names it, app POSTs `/v1/personal_access_tokens`. Server generates `tt_pat_<32 random bytes b64url>`, stores `bcrypt(token)`, returns plaintext **exactly once**. App copies to clipboard for the user.
- **Use**: external client sends `Authorization: Bearer tt_pat_...`. Server hashes incoming token, looks up by `token_hash`, bumps `last_used_at`.
- **Revoke**: user in settings taps "Revoke." Server sets `revoked_at`. Subsequent uses 401.

### Sign-up gate (email allowlist)

The data model supports many users (every table is `user_id`-scoped). The Firebase project itself is otherwise open — anyone with an email could sign in. To control who actually gets a user row in this instance, the server enforces an **email allowlist**:

- The allowlist is a list of email addresses (and/or a small set of domains, e.g., `@example.com`) loaded from an env var (`AUTH_EMAIL_ALLOWLIST`, comma-separated) or a small `allowed_emails` table — chosen at plan time. Either way, the allowlist is operator-managed; there is no user-facing invite UI in v1.
- On every authenticated request, the auth middleware checks: does `firebase_decoded.email` match the allowlist?
  - **No** → 403 with code `email_not_allowlisted`. No user row is created. Clients should surface a "this instance is invite-only — ask the operator to add you" message.
  - **Yes, no `users` row yet** → create the `users` row using `firebase_decoded.uid` as `id`. Now they're in.
  - **Yes, `users` row exists** → proceed normally.
- The allowlist is **independent of Firebase Auth provider config**. Even if you enable Sign in with Apple/Google publicly in Firebase, only allowlisted emails get a tinkertask account.
- PATs are unaffected — they're already tied to an existing `user_id` (which only exists for allowlisted users).
- Removing someone from the allowlist on a future restart blocks their next sign-in. Existing PATs continue to work until revoked manually (acceptable for a "small group of friends" scenario).

### Threats and mitigations

| Threat | Mitigation |
|---|---|
| PAT leak via logging | Server never logs `Authorization` headers. Token hash only is stored. |
| Brute-force PAT guessing | 256-bit random tokens; rate limit auth failures. |
| Firebase ID token replay | Tokens are short-lived (1h); Firebase Admin SDK validates signature + expiry. |
| Cross-user data leak via `user_id` injection | All queries scoped by `user_id` resolved from auth, never from request body. |
| Adversarial syntax via `/v1/parse` | Parser is a regex+grammar; rejects malformed input with 400. No code execution path, no LLM, nothing to inject. Tag/scope names are bounded length + character class. |
| Random people creating accounts | Email allowlist (above) — sign-in succeeds in Firebase but server returns 403 if not allowlisted; no user row is created. |
| Single user spamming the API | Per-user rate limits on read + write endpoints (§7). |

## 13. External Integrations

| Integration | Used for | Scope |
|---|---|---|
| Firebase Auth | Flutter client identity. | Email link + Sign in with Apple + Sign in with Google. |
| FCM | Silent sync triggers; future user-facing notifications. | Server-side Firebase Admin; client SDK on device. |
| Cloud SQL | Postgres. | `db-f1-micro` shared-core tier in v1. |

## 14. Future Surfaces (informational)

Documented here so the API contract accommodates them — not built in this project.

### Obsidian plugin

- Separate repo (`tinkertask-obsidian`).
- TypeScript against Obsidian's Plugin API.
- Auth: PAT (generated in tinkertask Settings, pasted into plugin config).
- Behavior: polls `/v1/sync`, writes `<slug>.md` files into a chosen vault folder. Frontmatter mirrors task structured fields; body is freeform notes.
- Slug derivation: `kebab-case(title).truncate(40) + "-" + id[0..8]`. Documented in §15.

### MCP server

- Separate repo (`tinkertask-mcp`).
- TypeScript or Python wrapping the API.
- Auth: PAT in MCP server config.
- Tools exposed: `tinkertask.search(query)`, `tinkertask.create_task(parsed)`, `tinkertask.complete(task_id, value)`, `tinkertask.list_views()`, `tinkertask.run_view(view_id)`.
- Consumed by Claude Desktop, Claude Code, or any MCP client.

### Voice agent

- Separate process. Could be a Siri Shortcut + tiny server, a Telegram bot, a desktop assistant, etc.
- Records audio → its own STT → its own NL-to-structure step (small LLM, prompted to emit either capture syntax or structured JSON) → confirms with user → POST `/v1/tasks` (or `/v1/parse` first if it emitted syntax).
- Not specified further in this design. The API is the contract.

## 15. Slug Derivation (for future Obsidian plugin)

```
slug = kebab-case(title).truncate(40) + "-" + id[0..8]
```

E.g., task `id = 8a2f3c10-...`, title `"Pay rent"` → `pay-rent-8a2f3c10`.

Documented here so client and future plugin produce identical filenames.

## 16. Error Handling, Reliability, Testing

### Server

- All endpoints return the stable error envelope on failure.
- Auth failures 401, validation 400/422, server failures 500. No third-party outage paths (no LLM, no STT, no audio storage).
- Structured Cloud Logging logs (severity, request ID, user ID).

### Client

- Network errors during writes → entry stays in write queue; UI shows a "syncing…" indicator.
- Network errors during sync → silent retry on next trigger.
- Parse failures → form retains the user's text, surfaces "couldn't parse" with the raw text editable.

### Testing strategy

- **Server unit (Jest)**: capture-syntax parser, schema validators (view-JSON, recurrence), recurrence next-due, view-JSON → SQL compiler, target-period habit completion logic. NestJS service classes unit-tested with mocked Drizzle clients.
- **Server integration (Jest + testcontainers-Postgres or `pg-mem`)**: full app-bootstrap tests against ephemeral Postgres. Run all three fixture suites (`capture_syntax.json`, `view_queries.json`, `recurrence.json`). Firebase Admin verification stubbed via a test-token issuer; PAT verification uses real bcrypt against a seeded token.
- **Client unit**: capture-syntax parser (must match server on fixtures), drift queries, sync engine state machine, view-JSON → drift compiler (must match server), recurrence, target-period logic.
- **Client widget**: capture flow (live-preview parser, form behavior), dashboard render, view editor.
- **Cross-language fixture suite**: `fixtures/capture_syntax.json`, `fixtures/view_queries.json`, `fixtures/recurrence.json` — both server and client implementations must pass identical outputs.
- **Manual e2e on real devices**: FCM delivery latency, dashboard performance, capture latency.

## 17. Component Boundaries (for plan-time decomposition)

Suggested boundaries; plan-time may refine.

### Mobile (Flutter)

- `lib/ui/...` — screens and widgets per area.
- `lib/data/` — drift schema and repositories.
- `lib/query/` — view-JSON → drift compiler.
- `lib/sync/` — sync engine and write queue.
- `lib/api/` — HTTP client and DTOs.
- `lib/auth/` — Firebase Auth wrapper.
- `lib/notifications/` — FCM handler.
- `lib/recurrence/` — pure-Dart recurrence + target-period.

### Backend (Cloud Run, NestJS / TypeScript)

See §11 for the full module layout. Boundary summary:

- `src/auth/` — Firebase + PAT guard, allowlist check, user provisioning.
- `src/db/` — Drizzle schema (mirrors §4), generated migrations.
- One Nest module per entity (`tasks`, `completions`, `scopes`, `scope-types`, `tags`, `views`, `dashboards`, `devices`, `personal-access-tokens`).
- `src/parse/` — `/v1/parse` controller; depends on `src/shared/syntax/`.
- `src/sync/` — `/v1/sync` controller; depends on every entity module's repository.
- `src/shared/` — dual-implemented logic (syntax, query compiler, recurrence) + FCM helper + rate-limit counters.
- `api/recurrence/` — mirrors mobile.

## 18. Open Questions / Risks

1. ~~**Backend language**~~ — **decided: TypeScript + NestJS + Drizzle + peggy + Jest** (§3, §11). Closed.
2. **Scope depth UI cap**. Implicit: equals the number of `scope_types` the user has defined. No additional UI-side cap in v1. Revisit only if a particular screen breaks under deep nesting.
3. **View query expressiveness ceiling**. Flat JSON doesn't express OR-across-fields. Workaround: pin multiple views. If real-world use shows OR is wanted, upgrade to optional `"any_of"` array (non-breaking).
4. **Dashboard view freshness**. Default: re-run every render (cheap on local cache). If perf shows it matters, add a 30-sec result cache per view.
5. **PAT scoping**. v1: full-access. v2: per-scope (read-only, capture-only, complete-only). Documented; not built.
6. **Habit "value default"**. Per-habit configurable `+N` chip default — stored as another column on `tasks` (e.g., `default_increment int default 1`). Add if simple; otherwise hardcode to 1.
7. **Built-in seed views**. Should the app seed "Habits today", "Right now", "This week" on first launch? Default: yes — solves blank-page problem.
8. **Multi-dashboard timing**. Schema supports it; UI doesn't expose. When to expose: when the user actually wants a second dashboard. Not v1.
9. **Scope soft-delete semantics**. When a scope is deleted, what happens to its tasks: `scope_id = null` (orphan to "no scope") or `scope_id` retained but the scope itself hidden? Current spec says null on delete. Alternative: retain reference, treat deleted-scope tasks as filterable via a special "deleted scopes" pseudo-filter. Default null is simpler; revisit if needed.
10. **Allowlist storage**. Env var (`AUTH_EMAIL_ALLOWLIST`, comma-separated) vs. a small `allowed_emails` DB table. Env var is simpler but requires redeploy to change; table needs an admin endpoint or manual SQL. Default: env var for v1 (the friend list won't churn often). Revisit if it does.
11. **Rate-limit storage in multi-instance Cloud Run**. v1 uses in-process counters which works only with a single Cloud Run instance (or sticky routing). If we ever scale horizontally, move counters to Redis/Memorystore. Not v1 work.
12. **Collaboration features** (assignees, shared scopes/views, comments, teams). Big future design pass. Out of scope; revisit only when there's a real need.
13. **`use_count` consistency.** Maintained by application code on tag attach/detach. Drift; a periodic reconciliation job could recompute from `task_tags`. Acceptable for v1; revisit if dropdown ordering looks wrong.
14. **Tag deletion safety.** When the user deletes a tag that's referenced by saved views, the view query keeps the (now-tombstoned) tag ID. Behavior: server-side query compiler treats a tombstoned tag ID as "no tasks match" (empty result for `all`/`any`; ignored for `none`). The view UI should warn at delete time: "This tag is used by 3 saved views — they will return fewer results." Spec'd as v1 behavior; safe but might surprise the user.
15. **Capture syntax completeness.** The grammar in §8.1 covers tasks, habits, scopes, tags, due dates, recurrence, targets, and notes — every field on `tasks` except `body` (which `note:`/`--` covers). Open edges to revisit if usage shows pain: (a) syntax for setting `status` directly (`status:archived`); (b) richer date forms ("next-monday-after-fri" type), currently out of scope; (c) editing an existing task via syntax (currently capture-only); (d) scope creation via syntax — currently `@<path>` only references existing scopes; if you type `@nonexistent`, task-create returns `404 scope_not_found`. Auto-creation is a flag-gated future addition.
16. **Cost-of-no-LLM tradeoff.** Removing the LLM means: zero per-request cost, deterministic behavior, fully offline parsing, no provider lock-in. The cost is: a small learning curve for the syntax, and any inputs that don't conform get rejected (no fuzzy interpretation). If the syntax friction proves to be a real adoption barrier, we can either invest in better in-app affordances (autocomplete chips, syntax helper) or — if it gets bad enough — bolt a thin LLM-to-syntax converter behind a feature flag without touching the rest of the design. Documented; not v1 work.
17. **Scope-type seeding.** First-launch onboarding inserts one `scope_types` row: `{ name: "Project", position: 1 }`. User can rename, delete (if unused), or add more. Open Q: should we seed two (e.g., `Project` + `Phase`) to hint at the hierarchy feature? Default: one — simpler, less prescriptive. Revisit if users miss the feature.
18. **Capture-syntax scope auto-create.** When a user types `@nonexistent`, the parser succeeds (it's just a name string) but `POST /v1/tasks` returns `404 scope_not_found`. Auto-create on miss is plausible (use the user's lowest-position scope-type by default) but a) hides typos behind silent scope creation and b) needs a default-type rule. Deferred; the in-app form's scope picker disambiguates.
19. **Scope-type reorder atomicity.** `PATCH /v1/scope_types/:id` with a new `position` triggers a re-validation walk over every scope of every affected type. For a small user (dozens of scopes), this is trivial. If a user has thousands of scopes, this becomes a long transaction. Mitigation deferred until it bites; if it does, batch the validation and report failures without rolling the whole reorder back.

---

## Appendices

### A. Worked examples — capture syntax → ParsedTask

**Input:** `pay rent repeat:monthly/1 #bills`

**Output:**
```json
{
  "title": "pay rent",
  "body": null,
  "kind": "task",
  "due_at": null,
  "recurrence": { "kind": "monthly", "byday": 1, "byweekday": null, "every": null },
  "target_value": null,
  "target_period": null,
  "tags": ["bills"],
  "scope": null
}
```

**Input:** `meditate habit repeat:weekdays`

**Output:**
```json
{
  "title": "meditate",
  "body": null,
  "kind": "habit",
  "due_at": null,
  "recurrence": { "kind": "weekdays", "byday": null, "byweekday": null, "every": null },
  "target_value": 1,
  "target_period": "day",
  "tags": [],
  "scope": null
}
```
(Bare `habit` defaults to `target_value=1, target_period=day` — boolean daily habit.)

**Input:** `glasses of water habit target:8/day repeat:daily`

**Output:**
```json
{
  "title": "glasses of water",
  "body": null,
  "kind": "habit",
  "due_at": null,
  "recurrence": { "kind": "daily", "byday": null, "byweekday": null, "every": null },
  "target_value": 8,
  "target_period": "day",
  "tags": [],
  "scope": null
}
```

**Input:** `workout habit target:3/week #fitness`

**Output:**
```json
{
  "title": "workout",
  "body": null,
  "kind": "habit",
  "due_at": null,
  "recurrence": null,
  "target_value": 3,
  "target_period": "week",
  "tags": ["fitness"],
  "scope": null
}
```
(Weekly-target habits typically have `recurrence: null` — the recurrence is implicit in the weekly target. The dashboard surfaces them every day until the week's target is met.)

**Input:** `reply to sarah due:fri @work -- mention the Q2 budget`

**Output:**
```json
{
  "title": "reply to sarah",
  "body": "mention the Q2 budget",
  "kind": "task",
  "due_at": "2026-05-15T00:00:00Z",
  "recurrence": null,
  "target_value": null,
  "target_period": null,
  "tags": [],
  "scope": "work"
}
```
(`due:fri` resolves to the next Friday after today in the user's timezone. Today is 2026-05-11 (Monday), so next Friday is 2026-05-15.)

**Input (rejected):** `meditate habit due:fri` → `400 parse_failed`, `details.message = "due: is only valid for tasks, not habits"`.

### B. Worked examples — view queries

**View "Habits today":**
```json
{
  "filter": { "kind": ["habit"] },
  "group": "none",
  "display": { "show_completed": false, "compact": true }
}
```
(The "show today and not yet target-met" logic is in the client habit aggregator, not the view filter. Filter just narrows to habits.)

**View "Work — due this week":**
```json
{
  "filter": {
    "kind": ["task"],
    "scope": { "id": "work-scope-uuid", "include_descendants": true },
    "status": ["open"],
    "due": { "preset": "this_week" }
  },
  "sort": [{ "field": "due_at", "dir": "asc" }],
  "group": "due"
}
```

**View "Untagged inbox":**
```json
{
  "filter": {
    "kind": ["task"],
    "status": ["open"],
    "scope": { "id": null, "include_descendants": false },
    "tags": { "none": true }
  }
}
```

**View "Urgent follow-ups" (tag-driven, IDs not names):**
```json
{
  "filter": {
    "kind": ["task"],
    "status": ["open"],
    "tags": { "all": ["8a2f3c10-..."],
              "any": ["b1c4d2e7-...", "c3d5e6f8-..."] }
  },
  "sort": [{ "field": "due_at", "dir": "asc" }]
}
```
The view UI shows these as chips ("#followup", "#urgent OR #p1"); the stored JSON carries the tag UUIDs. If the user renames "#urgent" to "#critical," the view keeps working — the rendered chip just changes label.

### C. Dual-auth pseudocode

```
function authMiddleware(req):
  token = req.header("Authorization").stripPrefix("Bearer ")
  if not token: return 401
  if token.startsWith("tt_pat_"):
    hash = bcrypt_verify_lookup(token)
    pat = db.findPATByHash(hash)
    if not pat or pat.revoked_at: return 401
    db.update(pat, last_used_at = now())
    req.user_id = pat.user_id
  else:
    decoded = firebaseAdmin.verifyIdToken(token)
    if not decoded: return 401
    req.user_id = decoded.uid
  next()
```
