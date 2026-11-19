# UPES Academic Intelligence & Student Companion Portal

Responsive student companion MVP built on the existing Phase 1 foundation.

## Stack

- Web: Next.js 15, React 19, TypeScript, Tailwind CSS
- API: Fastify, TypeScript, Zod, Supabase JWT verification
- Persistence: PostgreSQL through Prisma, with an in-memory repository for local API development and tests
- Auth: Supabase email magic link; UPES passwords are never requested or stored

## Current features

| Area | Current behavior |
| --- | --- |
| Dashboard | Attendance overview and existing sample connector data, clearly labelled |
| Attendance | Existing attendance engine and simulator; authenticated account attendance read, and explicitly labelled mock connector sync |
| Student profile | Authenticated profile read and save through `/v1/me`, including the existing `degree` field |
| Assignments | Authenticated create/list/status endpoints plus manual-task delete; browser reminders and alarm presentation while the portal is open |
| Academic performance | Student-entered assessment weights, reverse target score, credit-weighted GPA/CGPA projections, semester transcript snapshots saved through the API |
| Calendar | Circular monthly view backed by account assignments when signed in; device-only alarms stay on this device |
| Academic Policy AI | Ranked cited excerpts from authenticated policy chunks and user-supplied local text; optional cited answer generation through the server-configured OpenAI Responses API |
| Directed Reading and backlogs | Authenticated account records, with local fallback when the API is unavailable |
| Notification preferences | Authenticated quiet-hour/offset preferences plus browser-local notification permission and alarm state |
| Placement readiness | Loads verified, sourced, current database criteria when available; student-entered thresholds are kept in this browser |

The profile, assignments, Directed Reading, backlog, notification-preference, semester academic-record, policy-search, and verified placement-rule retrieval APIs use existing database models. Assignment deadlines appear in the calendar from the account API; locally entered assignments remain browser-local. User-authored policy excerpts and placement criteria remain local to the current browser and do not sync between devices. Policy retrieval reads linked, effective, non-superseded chunks from the existing policy tables. If `OPENAI_API_KEY` and `OPENAI_MODEL` are configured on the API, `/v1/policies/answer` can generate a response constrained to retrieved passages and return numbered citations. It does not fabricate a fallback answer when the model is unavailable or no evidence is found. Local excerpts are sent to the configured model only after the student opts in on the screen; the API key remains server-side. The feature does not ingest or independently verify policies, so students must confirm source applicability with UPES. Placement-rule retrieval requires a verified rule linked to a current policy document and filters by the student batch when available; the publisher itself is not independently verified. No new grades, eligibility thresholds, policy rules, assignments, or official integrations are prefilled. User-entered placement checks remain indicative. GPA and grade results use values entered by the student; no UPES grade scale is assumed.

## Run locally

Prerequisites: Node.js 20+ and npm 10+.

```bash
npm ci
npm test
npm run typecheck
npm run dev:api
```

In a second terminal:

```bash
npm run dev:web
```

Copy `.env.example` to `.env` and set `SUPABASE_JWT_SECRET` (16+ characters for local HS256 testing) or `SUPABASE_JWKS_URL`. Configure `API_CORS_ORIGINS` for the web origin. Copy `apps/web/.env.example` to `apps/web/.env.local`, then set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL`.

Optional policy answer generation requires a server-only OpenAI API key and model configured in the API environment. Choose a model enabled for your API project and never place the key in a `NEXT_PUBLIC_` variable. Without those values, policy retrieval and citations still work, but the UI reports that generation is unavailable.

When `DATABASE_URL` is absent, the API uses an in-memory repository and API data is lost when it restarts. For persistence, configure Supabase/Postgres using the existing schema and SQL files. The schema has not been validated against a live database in this project. Review it before applying migrations; no database schema change is part of this MVP work.

## Data integrity and integration limits

- The included UPES connector is a **mock** using invented development data. It is not an official integration.
- Official UPES and Moodle integrations require approved access; no scraping, password handling, or access bypass is included.
- Browser assignment alarms and local trackers require the same browser profile. Alarm delivery requires the portal to remain open; closing the tab stops checks.
- New assignments without a manually selected alarm schedule all future notification offsets on this device; dismissing or snoozing advances to the next one. The alarm dialog and browser-notification checks run across portal pages while the portal remains open; quiet hours can defer the dialog. Alarms stop when the tab closes.
- Academic policy search returns cited passages from the configured database and student-saved excerpts. Optional answer generation uses only retrieved passages and requires an explicitly configured model; local text is excluded unless the student opts in. The feature does not fetch or verify policies and does not create embeddings.
- The Expo/mobile application is not present in this repository. The web pages are responsive, but native development, push notifications, and background exact alarms remain outstanding.

See [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) for implementation detail and remaining work.
