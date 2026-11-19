# Database

Source of truth: `prisma/schema.prisma`. Timestamps are UTC; display in `students.timezone`.

Groups: identity and structure (students, programs, semesters, courses, enrollments); attendance (summaries, per-class records); marks and grades (assessments, marks, grade_rules, transcripts); policy (policy_documents, policy_chunks with `vector(768)`); planning (directed_reading, backlogs, exams, placement_rules); work and delivery (assignments, academic_tasks, reminder_schedules, snooze_history, assignment_alarms, notifications, notification_preferences, device_notification_tokens); operations (sync_logs, audit_logs, jobs).

Decisions:
- `students.id` equals the Supabase auth user id.
- `source` (`synced | manual | imported | mock`) is stored on data rows so the UI can label provenance.
- Embeddings are 768-dimensional (works with Gemini embeddings and common local models). Changing provider dimension requires a migration.
- `grade_rules` and `placement_rules` have `verified` and a source document link. Nothing is pre-filled.
- Courses are shared reference data. A student's sync may create a missing course (credits default 0) but never edits an existing one.
- `assignments` are unique on `(student, source, external_id)`, which prevents duplicates on re-sync.
- Not yet exercised against a real Postgres. Review the first migration before applying it.
