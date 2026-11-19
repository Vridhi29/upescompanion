import { MockUpesConnector } from "@upes/connectors";
import { AttendanceSummaryDto } from "@upes/schemas";
import {
  alertLevel,
  classesToRecover,
  DEFAULT_TARGETS,
  maxMissable,
  overall,
  summarize,
  type AlertLevel,
  type SubjectAttendanceSummary,
} from "@upes/core";

export interface SubjectView extends SubjectAttendanceSummary {
  courseCode: string;
  courseName: string;
  source?: string;
}

export interface AttendanceView {
  source: "mock" | "account";
  target: number;
  subjects: SubjectView[];
  overall: SubjectAttendanceSummary;
}

/** UI label for data whose API provenance is absent or outside the supported enum. */
export function attendanceSourceLabel(source: string | undefined): "Sample" | "Unverified source" | null {
  if (source === "mock") return "Sample";
  if (source === "synced" || source === "manual" || source === "imported") return null;
  return "Unverified source";
}

/** Supplies explicitly labelled development sample rows when an account has no recorded attendance. */
export async function loadMockAttendance(target = DEFAULT_TARGETS.personal): Promise<AttendanceView> {
  const res = await new MockUpesConnector().fetchAttendance();
  const rows = res.data.map((r) => AttendanceSummaryDto.parse(r));
  const subjects = rows.map((r) => ({
    courseCode: r.courseCode,
    courseName: r.courseName,
    source: "mock",
    ...summarize({ attended: r.attended, conducted: r.conducted }, target),
  }));
  const total = overall(rows.map((r) => ({ attended: r.attended, conducted: r.conducted })));
  return {
    source: "mock",
    target,
    subjects,
    overall: {
      counts: total.counts,
      percentage: total.percentage,
      missed: total.counts.conducted - total.counts.attended,
      target,
      marginPoints: total.percentage === null ? null : total.percentage - target,
      canMiss: maxMissable(total.counts, target),
      mustAttend: classesToRecover(total.counts, target),
      alert: alertLevel(total.percentage),
    },
  };
}

export function verdict(s: SubjectAttendanceSummary): string {
  if (s.percentage === null) return "No classes held yet";
  if (s.canMiss > 0) return `You can miss ${s.canMiss} more ${s.canMiss === 1 ? "class" : "classes"}`;
  if (s.mustAttend === 0) return "Right on target. Don't miss the next class";
  if (s.mustAttend === null) return "This target can no longer be reached";
  return `Attend the next ${s.mustAttend} in a row`;
}

export function statusWord(a: AlertLevel, t = DEFAULT_TARGETS): string {
  switch (a) {
    case "ok": return "On track";
    case "below_personal": return `Under your ${t.personal}% target`;
    case "approaching_minimum": return `Close to the ${t.minimum}% minimum`;
    case "below_minimum": return `Below the ${t.minimum}% minimum`;
    default: return "No data";
  }
}
