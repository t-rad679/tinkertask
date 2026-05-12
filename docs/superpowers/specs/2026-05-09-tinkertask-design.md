# tinkertask — Design

**Date:** 2026-05-09
**Status:** Draft (pending user review)
**Stage:** Design / Spec — precedes implementation planning

---

## 1. Overview

tinkertask is a personal task and habit tracker built around voice capture. The user speaks ("remind me to pay rent every first of the month"), the app turns the utterance into a structured task or habit, and the data is synced across the user's devices. Habits — repeatable tasks — get first-class visual treatment in the UI.

**Built for one user (the author) initially, with multi-device support.** Not designed for collaboration or multi-tenancy beyond per-user data isolation.

## 2. v1 Scope

### In scope

- Voice-driven task and habit creation (speech → structured object → DB).
- Manual task and habit completion (tap to check off).
- Today view with habits surfaced at the top, tasks below.
- Habit detail view with year-long heatmap.
- Recurrence: daily, weekdays, weekly (with day selection), monthly (day-of-month), every-N-days.
- Multi-device sync via pull-based delta API + FCM push trigger.
- Firebase Auth (email link, Sign in with Apple, Sign in with Google).
- Local offline reads + outbound write queue.

### Explicit non-goals (v1)

- **No markdown export from the mobile app.** Obsidian integration moves to a separate project (an Obsidian plugin that consumes the tinkertask API). Designed for, not built here.
- No voice editing of existing tasks ("mark workout done by voice"). v2.
- No conversational AI / chat-style queries. v2.
- No proactive AI nudges or weekly review. v2+.
- No real-time multi-device updates (websockets / live cursors). FCM-triggered re-fetch is enough.
- No collaboration, sharing, or multi-user views.
- No subtasks, projects, or task hierarchies. Tags suffice.
- No calendar integration, time-blocking, or estimated durations.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Mobile (Flutter — iOS + Android)                        │
│  • UI layer (Today, habit detail, capture, settings)    │
│  • Local SQLite cache (drift)                           │
│  • Sync engine (pull deltas, push writes, LWW)          │
│  • Audio capture (record, upload to /capture)           │
│  • Firebase Auth SDK + FCM SDK                          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS · Authorization: Bearer <Firebase ID token>
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Backend — Cloud Run service (single container)          │
│  • Verifies Firebase ID token on every request          │
│  • REST: /capture, /sync, /tasks, /completions, /devices│
│  • Voice pipeline: audio → STT → LLM → DB → FCM fanout  │
└────────┬───────────────┬──────────────────────┬─────────┘
         ▼               ▼                      ▼
┌──────────────┐  ┌──────────────┐     ┌──────────────────┐
│ Cloud SQL    │  │ Vertex AI    │     │ Cloud Speech-    │
│ Postgres     │  │ Gemini 2.5   │     │ to-Text          │
│              │  │ Flash        │     │                  │
└──────────────┘  └──────────────┘     └──────────────────┘

┌──────────────┐  ┌──────────────┐     ┌──────────────────┐
│ Firebase     │  │ FCM          │     │ Cloud Storage    │
│ Auth         │  │ (sync push + │     │ (audio blobs;    │
│              │  │  notif v2)   │     │  ephemeral)      │
└──────────────┘  └──────────────┘     └──────────────────┘
```

### Key architectural decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend | Flutter (iOS + Android) | Single codebase, native performance, mature audio/auth packages. |
| Local storage | SQLite via the `drift` package | Offline source of truth, type-safe queries. |
| Backend platform | Cloud Run | Scales to zero, container-based, suits the AI pipeline's variable shape. |
| Database | Cloud SQL for Postgres | Relational model fits the data; user has Postgres preference. |
| Sync | Pull-based delta API + FCM data-message trigger | Eventually-consistent within seconds is what's actually needed; avoids websocket infrastructure. |
| Auth | Firebase Auth | Already required for FCM; one SDK covers email link, Apple, Google. |
| LLM | Gemini 2.5 Flash via Vertex AI | Cheap, fast, good enough for parse. Abstracted so Claude swap is a config change. |
| STT | Cloud Speech-to-Text | Native GCP fit; quality is excellent. |
| Push | Firebase Cloud Messaging | Doubles as silent sync trigger and (in v2) user-facing notifications. |
| Audio storage | Cloud Storage, deleted post-transcription | Don't keep PII voice data we don't need. |

### What runs where

- **All AI work is server-side.** API keys (Vertex AI, anything else) never touch the device.
- **All vault writes happen client-side** — but only via the future Obsidian plugin, not the mobile app. The mobile app has no filesystem code beyond audio recording.
- **Sync state is per-row updated_at + tombstones**, not a separate sync log.

## 4. Data Model

### Postgres tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | text PK | Matches Firebase UID. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `tasks`
Holds both tasks and habits — they share a model. The `kind` column distinguishes them; the `recurrence` column distinguishes one-shot from repeating.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Server-generated. Used as the slug for the future Obsidian plugin's `<slug>.md`. |
| user_id | text FK→users.id | Indexed. |
| title | text | |
| body | text | Optional notes / freeform body. |
| kind | text | `'task'` or `'habit'`. Habits get heatmap detail view; tasks don't. |
| status | text | `'open'`, `'completed'`, `'archived'`. **Any row with a non-null `recurrence` stays `'open'` indefinitely** — that includes both habits and recurring tasks. Per-occurrence completion is recorded in the `completions` table. Only one-shot tasks (recurrence is null) transition to `'completed'`. |
| due_at | timestamptz null | Date a one-shot task is due. Null for habits and undated tasks. |
| recurrence | jsonb null | Recurrence rule (see §5). Null for one-shot tasks. |
| tags | text[] | Free-form tags. |
| created_at | timestamptz | |
| updated_at | timestamptz | Bumped on every write. The basis for sync deltas. |
| completed_at | timestamptz null | For one-shot tasks only. Habit/recurring completions live in `completions`. |
| deleted_at | timestamptz null | Tombstone — never hard-deleted, so sync can propagate the deletion. |

**Indexes:**
- `(user_id, updated_at)` — primary sync delta scan.
- `(user_id, status) where deleted_at is null` — for "active task list" queries.
- `(user_id, kind) where deleted_at is null` — for the Today screen partition.

#### `completions`
One row per habit/recurring completion event.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | Denormalized for fast per-user scans + tombstone cleanup. |
| task_id | uuid FK→tasks.id | |
| completed_on | date | The day this counts for. Date, not timestamp — habits are day-grain. |
| notes | text null | Optional per-completion note. |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz null | Tombstone (un-completing a habit). |

**Indexes:**
- `(user_id, updated_at)` — sync delta.
- `(task_id, completed_on)` — habit detail view (year heatmap).
- Unique constraint: `(task_id, completed_on) where deleted_at is null` — one completion per habit per day.

#### `devices`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text FK→users.id | |
| fcm_token | text | Updated when the OS rotates it. |
| platform | text | `'ios'` or `'android'`. |
| last_seen_at | timestamptz | Updated on every sync. |
| created_at | timestamptz | |

The FCM fanout reads from this table — every device of a user except the one that initiated the write gets a silent data message.

### Recurrence JSONB shape

```json
{
  "kind": "daily" | "weekdays" | "weekly" | "monthly" | "every_n_days",
  "byweekday": [0, 2, 4],
  "byday": 1,
  "every": 3
}
```

Only the fields relevant to `kind` are meaningful:
- `daily` — no extra fields.
- `weekdays` — no extra fields. (Mon–Fri.)
- `weekly` — `byweekday` is a list of integers, 0 = Monday … 6 = Sunday.
- `monthly` — `byday` is the day-of-month (1–28; we cap at 28 to avoid month-length edge cases).
- `every_n_days` — `every` is the interval.

The "next due date" is a derived value computed from `recurrence` + `created_at` + most-recent `completed_on`. Server and client both must compute it deterministically; we keep this logic in shared documentation but each implements its own (Dart on the client, Python or Node on the server).

## 5. Voice → Task Pipeline

### Flow

1. User taps and holds the capture button → app records audio (constant bit rate, mono, 16 kHz, ≤ 30 s).
2. On release, app uploads the audio to `POST /capture` with the Firebase ID token.
3. Cloud Run handler:
   - Stores the audio in Cloud Storage with a 1-hour TTL bucket lifecycle policy.
   - Calls Cloud Speech-to-Text (`latest_short` model) → transcript.
   - Sends the transcript to Gemini 2.5 Flash with a structured-output schema (see below) and a system prompt that includes today's date and timezone.
   - Validates the LLM output against the JSON schema (reject and surface error if invalid).
   - Inserts the resulting task/habit into Postgres.
   - Fans out a silent FCM data message to the user's other devices: `{ "type": "sync_hint" }`.
   - Returns the created task as JSON to the originating client.
   - Deletes the audio blob from Cloud Storage.

### LLM output schema (Gemini structured output)

```json
{
  "title": "string",
  "body": "string | null",
  "kind": "task | habit",
  "due_at": "ISO-8601 datetime | null",
  "recurrence": {
    "kind": "daily | weekdays | weekly | monthly | every_n_days | null",
    "byweekday": "[int] | null",
    "byday": "int | null",
    "every": "int | null"
  } | null,
  "tags": ["string"]
}
```

### Prompt-shape principles

- System prompt provides the schema, today's date, the user's timezone, and 2–3 worked examples ("remind me to pay rent every 1st" → monthly, byday: 1).
- The model must classify `kind`: explicit habit-cue language ("daily", "every day", "habit", "build the habit of") → `habit`; everything else → `task`.
- If the user's utterance is ambiguous (e.g., "pay rent" with no recurrence cue), the model returns the simplest interpretation (one-shot task, no due date) — not a clarifying question. v1 favors capture speed over precision; the user can edit after.

### LLM provider abstraction

The Cloud Run service exposes the LLM call through a thin interface (`LLMProvider.parseTask(transcript) → ParsedTask`). The Gemini implementation is the only one in v1. Adding a Claude implementation later is one new file plus a config switch.

### Failure modes (and what we do)

| Failure | Behavior |
|---|---|
| STT returns empty / low confidence | Surface "couldn't hear that" to user; offer retry. No DB write. |
| LLM output fails schema validation | Retry once. If still invalid, surface "couldn't parse that" with the transcript so user can manually create. No DB write. |
| Audio upload fails | Client retries with exponential backoff. If still failing, queue the audio locally and retry on next foreground. |
| Server cannot reach Vertex AI / STT | 503 to client. Client surfaces "AI is down right now"; falls back to manual task creation form pre-filled with the transcript if STT succeeded. |

## 6. Sync Mechanism

### Endpoints

- `GET /sync?since=<ISO-8601 timestamp>` → returns all rows from `tasks`, `completions`, `devices` where `updated_at > since` OR `deleted_at > since`. Includes a `now` field (server time) the client uses as the next `since`.
- `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id` (soft delete).
- `POST /completions`, `DELETE /completions/:id` (soft delete).
- `POST /devices` — register/update FCM token + platform.

### Client-side sync engine

The client holds a `last_synced_at` value per user (stored in SQLite). On:

- App foreground.
- Pull-to-refresh.
- Receipt of an FCM data message with `type: "sync_hint"`.
- After every successful local write to the server.

… it calls `GET /sync?since=<last_synced_at>`, applies the deltas to its SQLite mirror using last-write-wins per row (server's `updated_at` is authoritative), then sets `last_synced_at = response.now`.

### Outbound writes

Every local mutation goes to a **write queue** (a SQLite table). A background worker drains the queue, calling the appropriate POST/PATCH/DELETE. On success, the row is removed from the queue and the canonical row is updated from the server response. On network failure, the queue retains the entry and retries with exponential backoff. The UI reads from the local DB, so a queued write is visible immediately.

### Device registration

The mobile app registers itself with `POST /devices` immediately after a successful Firebase Auth sign-in, sending the current FCM token and platform. It re-registers when:

- The FCM token rotates (Firebase SDK callback).
- The user signs in on a fresh install.

On sign-out, the app calls `DELETE /devices/:id` (the active device) so the server stops fanning out sync hints to a signed-out client.

### FCM fanout

When the server writes to `tasks` or `completions`, it pushes a silent FCM data message to every device in the user's `devices` table **except** the originating device. Payload is the bare minimum: `{ "type": "sync_hint" }`. The receiving device responds by triggering a `/sync` call.

### Conflict handling

Last-write-wins, server-side `updated_at` is authoritative. Acceptable because:

- A single user can't realistically be editing the same task on two devices simultaneously.
- Tombstoned rows beat un-tombstoned ones (deletes win against concurrent edits).

## 7. Mobile App Structure

### Screens

- **Today** — single primary screen. Habits at top with last-7-days dots and 🔥 streak counter. Tasks below grouped by due date (Overdue, Today, Upcoming). Capture button (large, fixed at bottom).
- **Habit detail** — opened when user taps a habit. Year heatmap (GitHub-style), full completion log, edit/delete affordances.
- **Task detail** — opened when user taps a task. Editable title, body, due date, recurrence, tags, status.
- **Capture** — modal triggered from Today. Tap-and-hold to record; release to upload. Shows transcription + parsed result; user can confirm or edit before save.
- **Settings** — sign in/out, registered device list, "About," v2 toggle area for future features.

### Navigation

A single bottom tab is overkill for v1. Today is home; details are pushed routes; capture is a modal.

### State management

Riverpod (or BLoC if the user prefers — Riverpod is the recommendation: simpler tree, better fits the "DB is source of truth, UI subscribes" pattern). Repository layer wraps `drift` queries; Riverpod providers expose streams for the UI.

### Key Flutter packages (anticipated)

- `drift` — SQLite ORM.
- `firebase_core`, `firebase_auth`, `firebase_messaging`.
- `record` — audio capture.
- `dio` (or `http`) — networking.
- `riverpod` / `flutter_riverpod` — state.
- `intl` — date formatting / timezone.

## 8. Habits Visibility (UI)

Two surfaces. Not negotiable; this is the spine of the app.

### Today surface (Style B)

Habits sit at the top of the Today screen, above the task list and clearly grouped under a "Habits" label. Each habit row shows:

- A round checkbox (filled green when completed today).
- The habit title.
- A row of seven dots — the last seven days. Filled = completed, empty = missed. Today is the rightmost dot.
- A streak counter (🔥 N) at the right.

Tapping the checkbox marks today's completion. Tapping anywhere else opens the habit detail view.

### Habit detail (Style A)

A vertically-scrolling page with:

- Habit title, edit/delete actions.
- Current streak, longest streak, total completions, completion rate over last 30/90/365 days.
- A year-long heatmap grid (52 columns × 7 rows, GitHub-style). Color intensity from "0 completions in window" → "consistent." Tap a cell to see/toggle that day's completion.
- Edit fields: title, body, recurrence, tags.

## 9. API Surface

All endpoints require `Authorization: Bearer <Firebase ID token>`. All return JSON.

| Method | Path | Purpose |
|---|---|---|
| POST | `/capture` | Multipart audio upload → returns parsed task. |
| GET | `/sync?since=<ts>` | Returns rows changed since `<ts>`, including tombstones. |
| POST | `/tasks` | Create a task or habit (manual; bypasses the AI). |
| PATCH | `/tasks/:id` | Partial update. |
| DELETE | `/tasks/:id` | Soft delete (sets `deleted_at`). |
| POST | `/completions` | Mark a habit/recurring task complete for a given date. |
| DELETE | `/completions/:id` | Un-mark a completion. |
| POST | `/devices` | Register or update device's FCM token. |
| DELETE | `/devices/:id` | Deregister device (called on sign-out). |

The API is designed as a **public contract** because the future Obsidian plugin will consume it. That implies:

- Versioning prefix (`/v1/...`) from day one, not added later.
- Stable error shape (`{ "error": { "code": "...", "message": "..." } }`).
- Pagination contract on `/sync` for when delta sets get large (cursor-based, `next_cursor` field).

## 10. External Integrations

| Integration | Used for | Scope |
|---|---|---|
| Firebase Auth | User identity. | Email link + Sign in with Apple + Sign in with Google. |
| FCM | Silent sync triggers (v1); user-facing notifications (v2). | Server holds Firebase Admin credentials; client SDK on device. |
| Vertex AI | Structured task extraction. | Gemini 2.5 Flash; behind `LLMProvider` abstraction. |
| Cloud Speech-to-Text | Audio → transcript. | `latest_short` model; English first, expand later. |
| Cloud Storage | Audio blob staging. | One bucket; lifecycle rule deletes objects after 1 hour. Server deletes proactively after transcription. |
| Cloud SQL | Postgres database. | `db-f1-micro` shared-core tier in v1. Migrations managed with a standard tool (`sqlx`/`alembic`/`prisma migrate` — pick at plan time based on backend language). |

## 11. Future: Obsidian Plugin (separate project)

Tracked here so the API contract can accommodate it from day one — not built as part of tinkertask v1.

The plugin will:

- Live in a separate repo (`tinkertask-obsidian` or similar).
- Be written in TypeScript against Obsidian's Plugin API.
- Authenticate to the tinkertask backend with a Personal Access Token generated from the mobile app's settings screen. (PAT model preferred over embedding Firebase Auth web SDK in the plugin.)
- Poll `GET /sync` and write `<task-slug>.md` files into the user's chosen vault folder. Frontmatter mirrors the task's structured fields; body is freeform notes.
- Optionally render in-Obsidian views (today list, heatmap) as a stretch.

**Implications for the v1 design:**

- Add a `personal_access_tokens` table (or equivalent) to the data model — but defer building the create/revoke endpoints until the plugin actually exists. (It's a documented future addition, not v1 work.)
- Keep API responses stable and versioned.
- Don't bake the slug-generation logic deep into the mobile app; the plugin needs to derive the same slug from a task ID. Slug = `<short-title-kebab>-<id-prefix-8>`. Documented and shared.

## 12. v2+ Roadmap (informational)

Listed in rough priority order, none of which is in scope here.

1. **Voice editing of existing tasks** — "mark workout done," "push dentist to Friday." Requires LLM tool/function calling and live retrieval of the user's current task list.
2. **Obsidian plugin** — separate project; consumes the v1 API.
3. **AI Q&A** — "what's due this week?", "how's my workout streak?" Conversational layer.
4. **Proactive nudges and weekly review** — server-side scheduled job that drafts a weekly digest, delivered via FCM notification.
5. **Apple Watch / quick-capture widget**.
6. **iOS Share sheet target** — "share text → make a task."
7. **Desktop app** — only if the Obsidian plugin doesn't satisfy desktop-side use.
8. **Real-time multi-device updates** — only if FCM-triggered sync proves insufficient.

## 13. Error Handling, Reliability, and Testing

### Error handling (server)

- All endpoints return a stable error envelope on failure.
- Auth failures are 401, validation failures 400, server failures 500. Vertex AI / STT outages are 503 with a `Retry-After` hint.
- All errors are logged with Cloud Logging structured logs (severity, request ID, user ID).

### Error handling (client)

- Network errors during writes → entry stays in write queue; UI shows a small "syncing…" indicator.
- Network errors during sync → silent retry on next trigger; user-visible only if it persists past N retries.
- Voice capture failures → user-facing toast with retry.

### Testing strategy (high-level)

- **Server unit tests**: schema validators, recurrence-next-due computation, LLM output validator, sync delta query.
- **Server integration tests**: against an ephemeral Postgres + a fake LLM provider (returning canned structured output) + a fake STT.
- **Client unit tests**: drift queries, sync engine state machine, recurrence-next-due (must produce identical output to server's implementation — share a fixture file).
- **Client widget tests**: capture flow, today screen, habit detail.
- **Manual end-to-end on real devices**: voice capture quality, permission flows, FCM delivery latency.

## 14. Component Boundaries (for plan-time decomposition)

Suggested module structure. Plan-time may refine.

### Mobile (Flutter)

- `lib/ui/` — screens and widgets.
- `lib/data/` — drift models, queries, repositories.
- `lib/sync/` — sync engine, write queue.
- `lib/audio/` — recording and upload.
- `lib/auth/` — Firebase Auth wrapper.
- `lib/api/` — HTTP client, request/response models.
- `lib/notifications/` — FCM handler.
- `lib/recurrence/` — pure-Dart recurrence logic (mirrors backend).

### Backend (Cloud Run)

- `api/` — HTTP handlers, request validation.
- `auth/` — Firebase token verification middleware.
- `db/` — migrations, query layer.
- `voice/` — audio → STT → LLM pipeline.
- `llm/` — `LLMProvider` interface + Gemini implementation.
- `sync/` — delta query, FCM fanout.
- `recurrence/` — recurrence logic (mirrors mobile).

## 15. Open Questions / Risks

1. **Backend language choice.** Not decided. Reasonable options: Node/TypeScript, Python, Go. Decision deferred to plan-time. Constraints: solid Vertex AI client, solid Postgres client, solid Firebase Admin SDK. All three languages satisfy.
2. **STT model choice.** `latest_short` is the recommended starting point for short utterances (≤ 30 s). May need to evaluate `latest_long` if users record longer captures.
3. **Audio encoding.** v1 will use whatever Flutter's `record` package gives us by default (likely AAC m4a). Confirm STT compatibility and adjust if needed.
4. **Cost ceiling.** Personal use will run a few dollars per month total at v1 scope. No cost-control mechanisms in v1; revisit if usage grows.
5. **Migration strategy.** First migration will create the schema; subsequent migrations are forward-only. Tool TBD by language.
6. **Testing without real device fleet.** FCM delivery latency varies. Plan for manual two-device testing; CI cannot meaningfully cover this.

---

## Appendices

### A. Worked examples — voice → structured output

**Input:** "Remind me to pay rent every first of the month"
**Output:**
```json
{
  "title": "Pay rent",
  "body": null,
  "kind": "task",
  "due_at": null,
  "recurrence": { "kind": "monthly", "byday": 1, "byweekday": null, "every": null },
  "tags": []
}
```

**Input:** "I want to start meditating every weekday"
**Output:**
```json
{
  "title": "Meditate",
  "body": null,
  "kind": "habit",
  "due_at": null,
  "recurrence": { "kind": "weekdays", "byday": null, "byweekday": null, "every": null },
  "tags": []
}
```

**Input:** "Reply to Sarah by Friday"
**Output:**
```json
{
  "title": "Reply to Sarah",
  "body": null,
  "kind": "task",
  "due_at": "2026-05-15T00:00:00Z",
  "recurrence": null,
  "tags": []
}
```

**Input:** "Workout three times a week"
**Output:**
```json
{
  "title": "Workout",
  "body": null,
  "kind": "habit",
  "due_at": null,
  "recurrence": { "kind": "every_n_days", "every": 2, "byday": null, "byweekday": null },
  "tags": []
}
```

(Note: "three times a week" is genuinely ambiguous between fixed-day weekly and flex-frequency. We resolve it to `every_n_days: 2` for v1 — the model picks the simplest interpretation. The user can edit afterward.)

### B. Slug derivation

For the future Obsidian plugin's `<slug>.md` filename:

```
slug = kebab-case(title).truncate(40) + "-" + id[0..8]
```

E.g., task `id = 8a2f3c10-...`, title `"Pay rent"` → slug = `pay-rent-8a2f3c10`.

Documented here so client and plugin produce identical filenames.
