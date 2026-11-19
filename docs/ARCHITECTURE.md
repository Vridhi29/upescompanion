# Architecture (Phase 1)

```
Next.js (web)  ──►  Fastify API  ──►  Postgres (Supabase)
Expo (Phase 5) ──►      │
                        ├── @upes/core        pure engines (attendance now; grades, CGPA, planners later)
                        ├── @upes/connectors  UPES / Moodle interfaces + mock
                        └── @upes/schemas     Zod contracts shared by all apps
```

- **Auth:** Supabase Auth issues JWTs; the API verifies them (JWKS or legacy HS256 secret), checking audience and expiry. The API never sees UPES credentials.
- **Isolation:** every repository method takes a `studentId`; there is no cross-student read. The API's DB role bypasses RLS, so this scoping is the primary guard. RLS (`prisma/sql/02_rls.sql`) protects direct Supabase client and Realtime access.
- **Sync:** connector → validate (Zod) → compare with stored data → upsert accepted rows → write `sync_logs`. See `docs/CONNECTORS.md`.
- **Jobs (Phase 4):** `jobs` table with an idempotency key, claimed with `FOR UPDATE SKIP LOCKED`, drained by Supabase `pg_cron` calling a protected API endpoint. Vercel Hobby cron is daily only, so it is not used for reminders.
- **Mobile alarms (Phase 5):** Android exact alarms need a native module and the `SCHEDULE_EXACT_ALARM` permission (Play restricts `USE_EXACT_ALARM`). iOS gets time-sensitive local notifications only. Expo Go cannot receive Android push on current SDKs; a dev build is required. iOS remote push needs a paid Apple Developer account.

## Known limits of free tiers
Supabase Free pauses projects after about a week of inactivity. Vercel Hobby is non-commercial.
