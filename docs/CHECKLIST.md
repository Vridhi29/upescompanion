# Delivery checklist

## Foundation
- [x] Monorepo and shared schemas
- [x] Attendance calculation engine, planner, and tests
- [x] Authenticated API, profile, assignment, Directed Reading, backlog, notification preference, semester transcript snapshot, attendance, and sync routes
- [x] Authenticated policy search over existing policy chunks with citations and stale-document filtering
- [x] Authenticated placement-rule retrieval over verified rules linked to current, batch-applicable policy documents
- [x] Repository implementations scoped by student ID
- [x] Prisma schema retained, including `Student.degree`
- [ ] Validate schema and migrations against a real Supabase/Postgres project
- [ ] Run API database integration tests against Postgres

## Responsive web MVP
- [x] Shared visual design system, navigation, dashboard and attendance planner
- [x] Student profile settings backed by `/v1/me`
- [x] Assignment records backed by API, task status interactions, browser alarm dialog and notifications while portal is open
- [x] New assignment schedules all future configured offsets locally; dismiss and snooze advance the alarm sequence
- [x] Academic performance inputs and weight/grade-point calculators; semester snapshots save to `Transcript.payload`
- [x] Circular calendar dates backed by account assignments when authenticated, with local-only tasks retained on device
- [x] Ranked local policy excerpt retrieval with version/URL citations and a no-answer-on-no-match state
- [x] Directed Reading and backlog trackers backed by account API
- [x] Placement analyzer loads verified sourced criteria from the account API and compares them with student records; user-added criteria remain local
- [x] Notification preferences backed by account API; browser permission remains device-local
- [ ] Normalize snapshot entries into student-scoped assessment/mark records; add trusted admin workflows for policy ingestion and placement-rule entry
- [ ] Add push/service-worker scheduling for reminders when the portal is closed
- [x] Add API handler coverage for profile, assignment, Directed Reading, backlog, notification preference, transcript snapshot, policy search, and verified placement retrieval; add critical calculation/retrieval tests
- [ ] Execute tests and typechecks in an environment with the project dependencies available
- [ ] Manual responsive and accessibility review

## Advanced integrations
- [ ] Official policy ingestion, semantic embeddings, and grounded AI responses (local lexical retrieval exists)
- [ ] Official UPES integration using approved credentials/API access
- [ ] Moodle integration using approved access
- [ ] Expo/native mobile app, push delivery, and platform alarm behavior
- [ ] Configure and verify deployment environment

Current limitations and verification are tracked in [`DEVELOPMENT_STATUS.md`](../DEVELOPMENT_STATUS.md).
