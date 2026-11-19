/**
 * Attendance engine. Pure functions, no I/O.
 *
 * Attendance % = attended / conducted * 100
 * Overall attendance is aggregated by total classes (sum attended / sum conducted),
 * NOT by averaging subject percentages, so subjects with more classes weigh more.
 * Percentages are returned unrounded; round only when displaying.
 */

export interface AttendanceCount {
  attended: number;
  conducted: number;
}

export interface AttendanceTargets {
  /** Mandatory minimum (default 75). */
  minimum: number;
  /** Safety buffer (default 78). */
  buffer: number;
  /** Student's personal target (default 80). */
  personal: number;
}

export const DEFAULT_TARGETS: Readonly<AttendanceTargets> = {
  minimum: 75,
  buffer: 78,
  personal: 80,
};

export type AlertLevel =
  | "no_data"
  | "ok"
  | "below_personal"
  | "approaching_minimum"
  | "below_minimum";

export type AttendanceProvenance = "sample" | "account" | "mixed" | "unknown" | "empty";

/** Classify attendance rows without treating missing provenance as official account data. */
export function classifyAttendanceProvenance(sources: readonly unknown[]): AttendanceProvenance {
  if (sources.length === 0) return "empty";
  if (sources.some((source) => source !== "synced" && source !== "manual" && source !== "imported" && source !== "mock")) return "unknown";
  const hasSample = sources.some((source) => source === "mock");
  const hasAccount = sources.some((source) => source !== "mock");
  if (hasSample && hasAccount) return "mixed";
  return hasSample ? "sample" : "account";
}

export class AttendanceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceInputError";
  }
}

const EPS = 1e-9;

export function assertValidCount(c: AttendanceCount): void {
  const { attended, conducted } = c;
  if (!Number.isInteger(attended) || !Number.isInteger(conducted)) {
    throw new AttendanceInputError("Attended and conducted classes must be whole numbers.");
  }
  if (attended < 0 || conducted < 0) {
    throw new AttendanceInputError("Class counts cannot be negative.");
  }
  if (attended > conducted) {
    throw new AttendanceInputError("Attended classes cannot exceed classes conducted.");
  }
}

export function assertValidTarget(targetPercent: number): void {
  if (!Number.isFinite(targetPercent) || targetPercent <= 0 || targetPercent > 100) {
    throw new AttendanceInputError("Target must be greater than 0 and at most 100.");
  }
}

/** Attendance percentage, or null when no classes have been conducted. */
export function percentage(c: AttendanceCount): number | null {
  assertValidCount(c);
  if (c.conducted === 0) return null;
  return (c.attended / c.conducted) * 100;
}

export function missed(c: AttendanceCount): number {
  assertValidCount(c);
  return c.conducted - c.attended;
}

/**
 * Maximum number of additional classes that can be missed while staying at or
 * above the target. Largest x with attended / (conducted + x) >= target/100.
 * Returns 0 if the student is already at or below the target.
 */
export function maxMissable(c: AttendanceCount, targetPercent: number): number {
  assertValidCount(c);
  assertValidTarget(targetPercent);
  const x = Math.floor((100 * c.attended - targetPercent * c.conducted) / targetPercent + EPS);
  return Math.max(0, x);
}

/**
 * Minimum number of consecutive classes that must be attended to reach the
 * target. Smallest y with (attended + y) / (conducted + y) >= target/100.
 * Returns 0 if already at/above target, and null if the target cannot be reached
 * (only possible for a 100% target after any missed class).
 */
export function classesToRecover(c: AttendanceCount, targetPercent: number): number | null {
  assertValidCount(c);
  assertValidTarget(targetPercent);
  const shortfall = targetPercent * c.conducted - 100 * c.attended;
  if (shortfall <= EPS) return 0;
  if (targetPercent >= 100) return null;
  return Math.ceil(shortfall / (100 - targetPercent) - EPS);
}

export interface Projection {
  counts: AttendanceCount;
  percentage: number | null;
}

/** Projected attendance if the student attends `attend` and misses `miss` future classes. */
export function project(c: AttendanceCount, plan: { attend: number; miss: number }): Projection {
  assertValidCount(c);
  if (!Number.isInteger(plan.attend) || !Number.isInteger(plan.miss) || plan.attend < 0 || plan.miss < 0) {
    throw new AttendanceInputError("Planned classes must be non-negative whole numbers.");
  }
  const counts = {
    attended: c.attended + plan.attend,
    conducted: c.conducted + plan.attend + plan.miss,
  };
  return { counts, percentage: percentage(counts) };
}

export interface PlannedClass {
  /** ISO date (YYYY-MM-DD) of a future class. */
  date: string;
  /** true if the student plans to be absent. */
  absent: boolean;
}

export interface SimulationStep {
  date: string;
  absent: boolean;
  counts: AttendanceCount;
  percentage: number | null;
}

/** Absence simulator: walks through future classes in date order, giving projected % after each. */
export function simulateAbsences(c: AttendanceCount, planned: PlannedClass[]): SimulationStep[] {
  assertValidCount(c);
  const sorted = [...planned].sort((a, b) => a.date.localeCompare(b.date));
  let attended = c.attended;
  let conducted = c.conducted;
  return sorted.map((p) => {
    conducted += 1;
    if (!p.absent) attended += 1;
    const counts = { attended, conducted };
    return { date: p.date, absent: p.absent, counts, percentage: percentage(counts) };
  });
}

/** Aggregate across subjects by total classes. */
export function overall(subjects: AttendanceCount[]): Projection {
  subjects.forEach(assertValidCount);
  const counts = subjects.reduce(
    (acc, s) => ({ attended: acc.attended + s.attended, conducted: acc.conducted + s.conducted }),
    { attended: 0, conducted: 0 },
  );
  return { counts, percentage: percentage(counts) };
}

/**
 * Alert level for an attendance percentage.
 * - below_minimum: under the mandatory minimum
 * - approaching_minimum: at/above minimum but within `nearMargin` points of it
 * - below_personal: under the personal target but outside the minimum zone
 */
export function alertLevel(
  pct: number | null,
  targets: AttendanceTargets = DEFAULT_TARGETS,
  nearMargin = 2,
): AlertLevel {
  if (pct === null) return "no_data";
  if (pct < targets.minimum - EPS) return "below_minimum";
  if (pct < targets.minimum + nearMargin - EPS) return "approaching_minimum";
  if (pct < targets.personal - EPS) return "below_personal";
  return "ok";
}

export interface SubjectAttendanceSummary {
  counts: AttendanceCount;
  percentage: number | null;
  missed: number;
  target: number;
  /** Percentage points above (+) or below (-) the target. null if no data. */
  marginPoints: number | null;
  canMiss: number;
  mustAttend: number | null;
  alert: AlertLevel;
}

export function summarize(
  c: AttendanceCount,
  targetPercent: number,
  targets: AttendanceTargets = DEFAULT_TARGETS,
): SubjectAttendanceSummary {
  const pct = percentage(c);
  return {
    counts: c,
    percentage: pct,
    missed: missed(c),
    target: targetPercent,
    marginPoints: pct === null ? null : pct - targetPercent,
    canMiss: maxMissable(c, targetPercent),
    mustAttend: classesToRecover(c, targetPercent),
    alert: alertLevel(pct, targets),
  };
}
