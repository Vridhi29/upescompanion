import type { AcademicTaskStatus, AssignmentCreateInput, AttendanceSummaryDto, BacklogStatus, ConnectorProvider, DataSource, DirectedReadingStatus, NotificationPreferencesInput, StudentAcademicRecordInput, StudentProfile } from "@upes/schemas";
import type { PolicySource } from "@upes/core";

export interface StudentRecord {
  id: string;
  email: string;
  name: string | null;
  universityId: string | null;
  department: string | null;
  degree: string | null;
  specialization: string | null;
  batch: string | null;
  currentSemester: number | null;
  academicYear: string | null;
  attendanceTarget: number;
}

export interface AttendanceRow {
  courseCode: string;
  courseName: string;
  attended: number;
  conducted: number;
  asOf: string; // ISO
  source: DataSource;
}

export type SyncStatus = "running" | "success" | "partial" | "failed";

export interface SyncLogEntry {
  id: string;
  provider: ConnectorProvider;
  source: DataSource;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface UpsertCounts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface AssignmentRecord {
  id: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  dueAt: string | null;
  status: AcademicTaskStatus;
  source: DataSource;
}

export interface DirectedReadingRecord { id: string; courseCode: string; facultyGuide: string | null; status: DirectedReadingStatus; createdAt: string }
export interface BacklogRecord { id: string; courseCode: string; courseName: string; originalSemester: number; attempts: number; status: BacklogStatus; source: DataSource }
export interface NotificationPreferencesRecord extends NotificationPreferencesInput {}
export interface AcademicRecordRecord { semester: number; sgpa: number | null; payload: StudentAcademicRecordInput; source: DataSource; savedAt: string }
export interface PlacementRuleRecord {
  id: string;
  company: string;
  minCgpa: number | null;
  maxActiveBacklogs: number | null;
  minPercent: number | null;
  sourceTitle: string;
  sourceVersion: string;
  sourceUrl: string;
  sourceBatch: string | null;
}

/**
 * Persistence boundary. Every method is scoped by studentId: there is deliberately no
 * method that reads another student's data, which makes cross-student leaks hard to write.
 */
export interface AcademicRepository {
  ensureStudent(user: { id: string; email: string }): Promise<StudentRecord>;
  getStudent(studentId: string): Promise<StudentRecord | null>;
  updateProfile(studentId: string, profile: StudentProfile): Promise<void>;

  listAssignments(studentId: string): Promise<AssignmentRecord[]>;
  createAssignment(studentId: string, input: AssignmentCreateInput): Promise<AssignmentRecord>;
  updateAssignmentStatus(studentId: string, assignmentId: string, status: AcademicTaskStatus): Promise<AssignmentRecord | null>;
  deleteManualAssignment(studentId: string, assignmentId: string): Promise<boolean>;

  listDirectedReadings(studentId: string): Promise<DirectedReadingRecord[]>;
  createDirectedReading(studentId: string, input: { courseCode: string; facultyGuide?: string | null; status: DirectedReadingStatus }): Promise<DirectedReadingRecord>;
  updateDirectedReadingStatus(studentId: string, id: string, status: DirectedReadingStatus): Promise<DirectedReadingRecord | null>;
  listBacklogs(studentId: string): Promise<BacklogRecord[]>;
  createBacklog(studentId: string, input: { courseCode: string; courseName: string; originalSemester: number; attempts: number }): Promise<BacklogRecord>;
  updateBacklogStatus(studentId: string, id: string, status: BacklogStatus): Promise<BacklogRecord | null>;
  getNotificationPreferences(studentId: string): Promise<NotificationPreferencesRecord | null>;
  saveNotificationPreferences(studentId: string, input: NotificationPreferencesRecord): Promise<NotificationPreferencesRecord>;
  listAcademicRecords(studentId: string): Promise<AcademicRecordRecord[]>;
  saveAcademicRecord(studentId: string, input: StudentAcademicRecordInput): Promise<AcademicRecordRecord>;
  searchPolicySources(terms: string[]): Promise<PolicySource[]>;
  listVerifiedPlacementRules(studentId: string): Promise<PlacementRuleRecord[]>;

  listAttendance(studentId: string): Promise<AttendanceRow[]>;
  upsertAttendance(studentId: string, rows: AttendanceSummaryDto[], source: DataSource): Promise<UpsertCounts>;

  startSync(studentId: string, provider: ConnectorProvider, source: DataSource): Promise<string>;
  finishSync(
    studentId: string,
    syncId: string,
    result: { status: Exclude<SyncStatus, "running">; counts: UpsertCounts; errors: string[] },
  ): Promise<void>;
  lastSuccessfulSync(studentId: string, provider: ConnectorProvider): Promise<SyncLogEntry | null>;
  listSyncs(studentId: string, limit: number): Promise<SyncLogEntry[]>;
}
