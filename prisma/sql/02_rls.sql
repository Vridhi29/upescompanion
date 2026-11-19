-- Run AFTER the first migration. Row Level Security for Supabase.
--
-- Important: the Fastify API connects with the database owner role, which BYPASSES RLS.
-- The API therefore also scopes every query by the authenticated student id.
-- These policies protect the data from direct access through Supabase client libraries
-- (anon/authenticated roles) and from Supabase Realtime subscriptions.

-- Student-owned tables (have a student_id column)
do $$
declare t text;
begin
  foreach t in array array[
    'enrollments','attendance_summaries','attendance_records','marks','transcripts',
    'directed_reading','backlogs','assignments','academic_tasks','reminder_schedules',
    'snooze_history','assignment_alarms','notifications','notification_preferences',
    'device_notification_tokens','sync_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid())',
      t || '_owner', t);
  end loop;
end $$;

-- students: id is the auth user id
alter table public.students enable row level security;
drop policy if exists students_owner on public.students;
create policy students_owner on public.students for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- audit_logs: students may read their own entries but never write them
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs for select to authenticated
  using (student_id = auth.uid());

-- Shared reference data: read-only for signed-in users
do $$
declare t text;
begin
  foreach t in array array[
    'academic_programs','semesters','courses','assessments','grade_rules',
    'policy_documents','policy_chunks','placement_rules','exams'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- jobs: server only (RLS on, no policies = no access for anon/authenticated)
alter table public.jobs enable row level security;

-- Realtime for the floating notification ticker (Phase 4)
alter publication supabase_realtime add table public.notifications;
