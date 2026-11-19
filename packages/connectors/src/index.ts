import type { AttendanceSummaryDto, DataSource, StudentProfile } from "@upes/schemas";

/**
 * Connector contracts.
 *
 * The UPES Beta Portal and Moodle remain the official sources of truth. A connector only
 * READS authorised data; nothing here writes to university systems.
 *
 * IMPORTANT: no "official" implementation exists yet. Official connectors must use
 * UPES-approved SSO/API access. Do not scrape behind login, and never handle a student's
 * UPES password. Until access is authorised, use MockConnector or manual/CSV import.
 */
export interface ConnectorResult<T> {
  data: T;
  source: DataSource;
  fetchedAt: string; // ISO UTC
}

/** Raw rows are `unknown` on purpose: the sync service validates them before storing. */
export interface UpesPortalConnector {
  readonly id: string;
  readonly source: DataSource;
  fetchProfile(): Promise<ConnectorResult<StudentProfile>>;
  fetchAttendance(): Promise<ConnectorResult<unknown[]>>;
}

/** Moodle contract is declared now so the architecture is stable; implemented in Phase 4. */
export interface MoodleConnector {
  readonly id: string;
  readonly source: DataSource;
  fetchAssignments(): Promise<ConnectorResult<unknown[]>>;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export { MockUpesConnector, MOCK_ATTENDANCE } from "./mock";
export type { AttendanceSummaryDto };
