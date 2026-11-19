"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttendanceInputError,
  classesToRecover,
  classifyAttendanceProvenance,
  maxMissable,
  percentage,
  project,
  type AttendanceProvenance,
} from "@upes/core";
import { MOCK_ATTENDANCE } from "@upes/connectors";
import { MockBanner } from "@/components/MockBanner";
import { apiRequest } from "@/lib/api-client";
import { attendanceSourceLabel } from "@/lib/attendance-view";
import { getSupabase } from "@/lib/supabase";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const fmt = (p: number | null) => (p === null ? "no data" : `${p.toFixed(1)}%`);

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-rule bg-white px-3.5 py-2.5 tabular-nums shadow-sm shadow-black/[.02]"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default function AttendancePage() {
  type AttendanceRow = { courseCode: string; courseName: string; attended: number; conducted: number; asOf?: string; source?: string };
  const sampleRows = MOCK_ATTENDANCE.map((row) => ({ ...row }));
  const attendanceRequest = useRef(0);
  const [rows, setRows] = useState<AttendanceRow[]>(sampleRows);
  const [dataSource, setDataSource] = useState<AttendanceProvenance>("sample");
  const [apiMessage, setApiMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const first = MOCK_ATTENDANCE[0];
  const [subject, setSubject] = useState<string>(first.courseCode);
  const [attended, setAttended] = useState(String(first.attended));
  const [conducted, setConducted] = useState(String(first.conducted));
  const [target, setTarget] = useState("80");
  const [planAttend, setPlanAttend] = useState("5");
  const [planMiss, setPlanMiss] = useState("2");

  function resetSample(message = "") {
    attendanceRequest.current++;
    setRows(MOCK_ATTENDANCE.map((row) => ({ ...row })));
    setDataSource("sample");
    setSubject(first.courseCode);
    setAttended(String(first.attended));
    setConducted(String(first.conducted));
    setTarget("80");
    setPlanAttend("5");
    setPlanMiss("2");
    setApiMessage(message);
  }

  async function loadAccountAttendance() {
    const request = ++attendanceRequest.current;
    try {
      const result = await apiRequest<{ target: number; subjects: AttendanceRow[] }>("/v1/attendance");
      if (request !== attendanceRequest.current) return;
      if (result.subjects.length) {
        setRows(result.subjects);
        const mockCount = result.subjects.filter((row) => row.source === "mock").length;
        const classified = classifyAttendanceProvenance(result.subjects.map((row) => row.source));
        const source = classified === "empty" ? "unknown" : classified;
        setDataSource(source);
        setTarget(String(result.target));
        setSubject(result.subjects[0]!.courseCode);
        setAttended(String(result.subjects[0]!.attended));
        setConducted(String(result.subjects[0]!.conducted));
        setApiMessage(source === "mixed" ? `Loaded ${result.subjects.length} records, including ${mockCount} mock connector row${mockCount === 1 ? "" : "s"}.` : source === "sample" ? `Loaded ${result.subjects.length} sample connector records.` : source === "unknown" ? "One or more attendance records did not include provenance; their origin cannot be confirmed." : `Loaded ${result.subjects.length} account attendance records.`);
      } else {
        resetSample("No attendance records are saved to this account yet. Sample data remains available below.");
      }
    } catch (error) {
      if (request !== attendanceRequest.current) return;
      setApiMessage(error instanceof Error ? error.message : "Account attendance is unavailable.");
    }
  }

  useEffect(() => {
    let live = true;
    let authEventSeen = false;
    const supabase = getSupabase();
    if (!supabase) {
      resetSample("Sign in to load account attendance. Sample data is shown below.");
      return () => { live = false; };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventSeen = true;
      if (!session) resetSample("Sign in to load account attendance. Sample data is shown below.");
      else if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        resetSample();
        setTimeout(() => { if (live) void loadAccountAttendance(); }, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!live || authEventSeen) return;
      if (data.session) void loadAccountAttendance();
      else resetSample("Sign in to load account attendance. Sample data is shown below.");
    }).catch(() => { if (live && !authEventSeen) resetSample("Sign in to load account attendance. Sample data is shown below."); });
    return () => { live = false; attendanceRequest.current++; subscription.unsubscribe(); };
  }, []);
  async function syncMockConnector() {
    const sessionRequest = attendanceRequest.current;
    setSyncing(true);
    try {
      const response = await apiRequest<{ status: string; counts: { created: number; updated: number; unchanged: number } }>("/v1/sync/upes", { method: "POST" });
      if (sessionRequest !== attendanceRequest.current) return;
      await loadAccountAttendance();
      if (attendanceRequest.current !== sessionRequest + 1) return;
      setApiMessage(`Mock UPES connector ${response.status}: ${response.counts.created} new, ${response.counts.updated} updated, ${response.counts.unchanged} unchanged. These are sample records.`);
    } catch (error) {
      if (sessionRequest === attendanceRequest.current) setApiMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally { setSyncing(false); }
  }
  function pick(code: string) {
    setSubject(code);
    const row = rows.find((r) => r.courseCode === code);
    if (row) {
      setAttended(String(row.attended));
      setConducted(String(row.conducted));
    }
  }

  const result = useMemo(() => {
    try {
      const counts = { attended: num(attended), conducted: num(conducted) };
      const t = num(target);
      const plan = { attend: num(planAttend), miss: num(planMiss) };
      return {
        ok: true as const,
        current: percentage(counts),
        canMiss: maxMissable(counts, t),
        mustAttend: classesToRecover(counts, t),
        projected: project(counts, plan),
        t,
      };
    } catch (e) {
      return { ok: false as const, message: e instanceof AttendanceInputError ? e.message : "Enter whole numbers for every field." };
    }
  }, [attended, conducted, target, planAttend, planMiss]);

  return (
    <div className="mx-auto max-w-5xl space-y-7 sm:space-y-9">
      <header className="space-y-2">
        <div className="eyebrow text-muted">Plan with confidence</div>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Attendance planner</h1>
        <p className="max-w-prose text-muted">Work out how many classes you can skip, or how many you must attend, to hit a target.</p>
      </header>

      {dataSource === "sample" ? <MockBanner /> : dataSource === "mixed" ? <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">This view mixes account attendance with sample connector rows. Sample rows are invented development data and are not official UPES records.</div> : dataSource === "unknown" ? <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">The source of one or more attendance rows could not be confirmed. These rows are not identified as official account data.</div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Account data loaded from the attendance API. Each record retains its provenance in the API.</div>}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-white p-4">
        <button onClick={() => void loadAccountAttendance()} className="rounded-xl border border-rule px-4 py-2 text-sm font-semibold">Refresh account data</button>
        <button disabled={syncing} onClick={() => void syncMockConnector()} className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{syncing ? "Syncing…" : "Sync mock UPES connector"}</button>
        <span className="text-xs text-muted">The connector is a development mock, not an official UPES integration.</span>
      </div>
      {apiMessage && <p role="status" className="text-sm text-muted">{apiMessage}</p>}

      <section className="surface grid gap-5 rounded-2xl p-5 sm:grid-cols-2 sm:p-7">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">{dataSource === "sample" ? "Start from a sample subject" : "Choose a recorded subject"}</span>
          <select
            value={subject}
            onChange={(e) => pick(e.target.value)}
            className="mt-2 w-full rounded-xl border border-rule bg-white px-3.5 py-2.5"
          >
            {rows.map((r) => (
              <option key={r.courseCode} value={r.courseCode}>{attendanceSourceLabel(r.source) === "Sample" ? `Sample · ${r.courseName}` : attendanceSourceLabel(r.source) === "Unverified source" ? `Unverified source · ${r.courseName}` : r.courseName}</option>
            ))}
          </select>
        </label>
        <Field label="Classes attended" value={attended} onChange={setAttended} />
        <Field label="Classes conducted" value={conducted} onChange={setConducted} />
        <Field label="Target attendance (%)" value={target} onChange={setTarget} hint="Default 80. The mandatory minimum is 75." />
      </section>

      {!result.ok ? (
          <p role="alert" className="rounded-2xl border border-danger/30 bg-red-50 px-5 py-4 text-danger">{result.message}</p>
      ) : (
        <>
          <section aria-labelledby="actual" className="surface space-y-3 rounded-2xl p-5 sm:p-7">
            <div className="eyebrow text-muted">Recorded attendance</div>
            <h2 id="actual" className="text-xl font-semibold">Where you are now</h2>
            <p className="text-5xl font-medium tracking-[-0.05em] tabular-nums">{fmt(result.current)}</p>
            <p className="max-w-prose">
              {result.canMiss > 0
                ? `You can miss ${result.canMiss} more ${result.canMiss === 1 ? "class" : "classes"} and still be at or above ${result.t}%.`
                : result.mustAttend === 0
                  ? `You are exactly on ${result.t}%. Missing the next class would take you under.`
                  : result.mustAttend === null
                    ? `${result.t}% can no longer be reached after a missed class.`
                    : `You need to attend the next ${result.mustAttend} classes in a row to reach ${result.t}%.`}
            </p>
          </section>

          <section aria-labelledby="proj" className="space-y-5 rounded-2xl bg-[#111] p-5 text-white sm:p-7">
            <div>
              <div className="eyebrow text-white/45">Scenario builder</div>
              <h2 id="proj" className="mt-1 text-xl font-semibold">If you plan ahead (projected)</h2>
              <p className="text-sm text-white/55">A what-if. This is not recorded attendance.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 [&_label]:text-white [&_input]:border-white/15 [&_input]:bg-white/10 [&_input]:text-white">
              <Field label="Future classes you will attend" value={planAttend} onChange={setPlanAttend} />
              <Field label="Future classes you will miss" value={planMiss} onChange={setPlanMiss} />
            </div>
            <p className="max-w-prose">
              After {result.projected.counts.conducted - Number(conducted)} more classes you would have attended{" "}
              {result.projected.counts.attended} of {result.projected.counts.conducted}, which is{" "}
              <strong className="tabular-nums">{fmt(result.projected.percentage)}</strong>
              {result.projected.percentage !== null && (
                <> — {result.projected.percentage >= result.t ? "at or above" : "below"} your {result.t}% target.</>
              )}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
