import { ConnectorError, type UpesPortalConnector } from "@upes/connectors";
import { AttendanceSummaryDto, StudentProfile } from "@upes/schemas";
import type { AcademicRepository, SyncStatus, UpsertCounts } from "../repositories/types";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Retries retryable connector errors with exponential backoff. Other errors fail immediately. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ConnectorError && err.retryable;
      if (!retryable || i === attempts) break;
      await sleep(base * 2 ** (i - 1));
    }
  }
  throw lastErr;
}

export interface SyncOutcome {
  syncId: string;
  status: Exclude<SyncStatus, "running">;
  counts: UpsertCounts;
  errors: string[];
}

export interface SyncDeps {
  studentId: string;
  connector: UpesPortalConnector;
  repo: AcademicRepository;
  retry?: RetryOptions;
}

const NONE: UpsertCounts = { created: 0, updated: 0, unchanged: 0 };

/**
 * UPES portal sync. Guarantees:
 *  - Invalid rows are rejected and reported; they never overwrite good data.
 *  - An empty result when data already exists is treated as an incomplete sync and ignored.
 *  - A row whose totals went backwards, or that is older than what is stored, is ignored.
 *  - Every run is logged (success, partial, or failed).
 */
export async function syncUpesPortal({ studentId, connector, repo, retry }: SyncDeps): Promise<SyncOutcome> {
  const syncId = await repo.startSync(studentId, "upes", connector.source);
  const errors: string[] = [];
  const finish = async (status: SyncOutcome["status"], counts: UpsertCounts): Promise<SyncOutcome> => {
    await repo.finishSync(studentId, syncId, { status, counts, errors });
    return { syncId, status, counts, errors };
  };

  try {
    const [profileRes, attendanceRes] = await Promise.all([
      withRetry(() => connector.fetchProfile(), retry),
      withRetry(() => connector.fetchAttendance(), retry),
    ]);

    const profile = StudentProfile.safeParse(profileRes.data);
    if (profile.success) await repo.updateProfile(studentId, profile.data);
    else errors.push(`Profile ignored: ${profile.error.issues.map((i) => i.message).join("; ")}`);

    const valid: AttendanceSummaryDto[] = [];
    attendanceRes.data.forEach((raw, i) => {
      const parsed = AttendanceSummaryDto.safeParse(raw);
      if (parsed.success) valid.push(parsed.data);
      else errors.push(`Attendance row ${i + 1} rejected: ${parsed.error.issues.map((x) => x.message).join("; ")}`);
    });

    const existing = new Map((await repo.listAttendance(studentId)).map((r) => [r.courseCode, r]));

    if (valid.length === 0 && existing.size > 0) {
      errors.push("Source returned no usable attendance rows; existing records were kept.");
      return await finish("failed", NONE);
    }

    const accepted: AttendanceSummaryDto[] = [];
    for (const row of valid) {
      const prev = existing.get(row.courseCode);
      if (prev && row.conducted < prev.conducted) {
        errors.push(`${row.courseCode}: totals went backwards (${prev.conducted} → ${row.conducted}); row ignored.`);
        continue;
      }
      if (prev && new Date(row.asOf).getTime() < new Date(prev.asOf).getTime()) {
        errors.push(`${row.courseCode}: source data is older than stored data; row ignored.`);
        continue;
      }
      accepted.push(row);
    }

    const counts = accepted.length ? await repo.upsertAttendance(studentId, accepted, connector.source) : NONE;
    if (accepted.length === 0 && valid.length > 0) return await finish("failed", counts);
    return await finish(errors.length ? "partial" : "success", counts);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Unknown sync error");
    return await finish("failed", NONE);
  }
}
