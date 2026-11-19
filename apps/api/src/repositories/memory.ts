import { randomUUID } from "node:crypto";
import type { AcademicTaskStatus, AssignmentCreateInput, AttendanceSummaryDto, BacklogStatus, ConnectorProvider, DataSource, DirectedReadingStatus, NotificationPreferencesInput, StudentAcademicRecordInput, StudentProfile } from "@upes/schemas";
import type { PolicySource } from "@upes/core";
import type {
  AcademicRepository,
  AttendanceRow,
  StudentRecord,
  SyncLogEntry,
  UpsertCounts,
  AssignmentRecord,
  BacklogRecord,
  DirectedReadingRecord,
  AcademicRecordRecord,
  PlacementRuleRecord,
} from "./types";

/** In-memory repository used by tests and for running the API without a database. */
export class InMemoryRepository implements AcademicRepository {
  private students = new Map<string, StudentRecord>();
  private attendance = new Map<string, Map<string, AttendanceRow>>(); // studentId -> courseCode -> row
  private syncs = new Map<string, SyncLogEntry[]>();
  private assignments = new Map<string, AssignmentRecord[]>();
  private directedReadings = new Map<string, DirectedReadingRecord[]>();
  private backlogs = new Map<string, BacklogRecord[]>();
  private notificationPreferences = new Map<string, NotificationPreferencesInput>();
  private academicRecords = new Map<string, AcademicRecordRecord[]>();
  private policySources: PolicySource[] = [];

  seedPolicySources(sources: PolicySource[]) {
    this.policySources = sources.map((source) => ({ ...source }));
  }

  async ensureStudent(user: { id: string; email: string }): Promise<StudentRecord> {
    let s = this.students.get(user.id);
    if (!s) {
      s = {
        id: user.id,
        email: user.email,
        name: null,
        universityId: null,
        department: null,
        degree: null,
        specialization: null,
        batch: null,
        currentSemester: null,
        academicYear: null,
        attendanceTarget: 80,
      };
      this.students.set(user.id, s);
    }
    return { ...s };
  }

  async getStudent(studentId: string) {
    const s = this.students.get(studentId);
    return s ? { ...s } : null;
  }

  async updateProfile(studentId: string, p: StudentProfile) {
    const s = this.students.get(studentId);
    if (!s) throw new Error("Student not found");
    Object.assign(s, {
      name: p.name,
      universityId: p.studentId,
      department: p.department,
      degree: p.degree,
      specialization: p.specialization,
      batch: p.batch,
      currentSemester: p.currentSemester,
      academicYear: p.academicYear,
    });
  }

  async listAssignments(studentId: string) {
    return (this.assignments.get(studentId) ?? []).map((x) => ({ ...x }));
  }

  async createAssignment(studentId: string, input: AssignmentCreateInput): Promise<AssignmentRecord> {
    const row: AssignmentRecord = {
      id: randomUUID(), title: input.title, courseCode: input.courseCode ?? null,
      description: input.description ?? null, dueAt: input.dueAt ?? null,
      status: input.status, source: "manual",
    };
    this.assignments.set(studentId, [row, ...(this.assignments.get(studentId) ?? [])]);
    return { ...row };
  }

  async updateAssignmentStatus(studentId: string, assignmentId: string, status: AcademicTaskStatus) {
    const rows = this.assignments.get(studentId) ?? [];
    const row = rows.find((x) => x.id === assignmentId);
    if (!row) return null;
    row.status = status;
    return { ...row };
  }

  async deleteManualAssignment(studentId: string, assignmentId: string) {
    const rows = this.assignments.get(studentId) ?? [];
    const row = rows.find((item) => item.id === assignmentId && item.source === "manual");
    if (!row) return false;
    this.assignments.set(studentId, rows.filter((item) => item.id !== assignmentId));
    return true;
  }

  async listDirectedReadings(studentId: string) { return (this.directedReadings.get(studentId) ?? []).map((x) => ({ ...x })); }
  async createDirectedReading(studentId: string, input: { courseCode: string; facultyGuide?: string | null; status: DirectedReadingStatus }): Promise<DirectedReadingRecord> {
    const row = { id: randomUUID(), courseCode: input.courseCode, facultyGuide: input.facultyGuide ?? null, status: input.status, createdAt: new Date().toISOString() };
    this.directedReadings.set(studentId, [row, ...(this.directedReadings.get(studentId) ?? [])]);
    return { ...row };
  }
  async updateDirectedReadingStatus(studentId: string, id: string, status: DirectedReadingStatus) {
    const row = (this.directedReadings.get(studentId) ?? []).find((x) => x.id === id);
    if (!row) return null;
    row.status = status;
    return { ...row };
  }

  async listBacklogs(studentId: string) { return (this.backlogs.get(studentId) ?? []).map((x) => ({ ...x })); }
  async createBacklog(studentId: string, input: { courseCode: string; courseName: string; originalSemester: number; attempts: number }): Promise<BacklogRecord> {
    const rows = this.backlogs.get(studentId) ?? [];
    const existing = rows.find((x) => x.courseCode === input.courseCode);
    if (existing) return { ...existing };
    const row: BacklogRecord = { id: randomUUID(), ...input, status: "pending", source: "manual" };
    this.backlogs.set(studentId, [row, ...rows]);
    return { ...row };
  }
  async updateBacklogStatus(studentId: string, id: string, status: BacklogStatus) {
    const row = (this.backlogs.get(studentId) ?? []).find((x) => x.id === id);
    if (!row) return null;
    row.status = status;
    return { ...row };
  }

  async getNotificationPreferences(studentId: string) {
    const value = this.notificationPreferences.get(studentId);
    return value ? { ...value, channels: [...value.channels], reminderOffsetsMinutes: [...value.reminderOffsetsMinutes] } : null;
  }
  async saveNotificationPreferences(studentId: string, input: NotificationPreferencesInput) {
    const value = { ...input, channels: [...input.channels], reminderOffsetsMinutes: [...input.reminderOffsetsMinutes] };
    this.notificationPreferences.set(studentId, value);
    return { ...value, channels: [...value.channels], reminderOffsetsMinutes: [...value.reminderOffsetsMinutes] };
  }

  async listAcademicRecords(studentId: string) {
    return (this.academicRecords.get(studentId) ?? []).map((row) => ({ ...row, payload: { ...row.payload, assessments: [...row.payload.assessments], courses: [...row.payload.courses] } }));
  }

  async saveAcademicRecord(studentId: string, input: StudentAcademicRecordInput): Promise<AcademicRecordRecord> {
    const totalCredits = input.courses.reduce((sum, course) => sum + course.credits, 0);
    const sgpa = totalCredits ? input.courses.reduce((sum, course) => sum + course.credits * course.gradePoints, 0) / totalCredits : null;
    const row: AcademicRecordRecord = { semester: input.semester, sgpa, payload: { ...input, assessments: [...input.assessments], courses: [...input.courses] }, source: "manual", savedAt: new Date().toISOString() };
    const rows = this.academicRecords.get(studentId) ?? [];
    this.academicRecords.set(studentId, [row, ...rows.filter((x) => x.semester !== input.semester)]);
    return { ...row, payload: { ...row.payload, assessments: [...row.payload.assessments], courses: [...row.payload.courses] } };
  }

  async searchPolicySources(terms: string[]) {
    // The memory repository has no default corpus; tests may explicitly seed curated source fixtures.
    const normalized = terms.map((term) => term.toLocaleLowerCase());
    return this.policySources
      .filter((source) => Boolean(source.url) && normalized.some((term) => source.content.toLocaleLowerCase().includes(term)))
      .map((source) => ({ ...source }))
      .slice(0, 250);
  }

  async listVerifiedPlacementRules(_studentId: string): Promise<PlacementRuleRecord[]> {
    // No global placement criteria are shipped with the memory repository.
    return [];
  }

  async listAttendance(studentId: string): Promise<AttendanceRow[]> {
    return [...(this.attendance.get(studentId)?.values() ?? [])].map((r) => ({ ...r }));
  }

  async upsertAttendance(studentId: string, rows: AttendanceSummaryDto[], source: DataSource): Promise<UpsertCounts> {
    const store = this.attendance.get(studentId) ?? new Map<string, AttendanceRow>();
    this.attendance.set(studentId, store);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    for (const r of rows) {
      const prev = store.get(r.courseCode);
      if (!prev) counts.created++;
      else if (prev.attended === r.attended && prev.conducted === r.conducted) counts.unchanged++;
      else counts.updated++;
      store.set(r.courseCode, {
        courseCode: r.courseCode,
        courseName: r.courseName,
        attended: r.attended,
        conducted: r.conducted,
        asOf: r.asOf,
        source,
      });
    }
    return counts;
  }

  async startSync(studentId: string, provider: ConnectorProvider, source: DataSource) {
    const entry: SyncLogEntry = {
      id: randomUUID(),
      provider,
      source,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
    };
    this.syncs.set(studentId, [entry, ...(this.syncs.get(studentId) ?? [])]);
    return entry.id;
  }

  async finishSync(
    studentId: string,
    syncId: string,
    result: { status: "success" | "partial" | "failed"; counts: UpsertCounts; errors: string[] },
  ) {
    const entry = this.syncs.get(studentId)?.find((e) => e.id === syncId);
    if (!entry) return;
    Object.assign(entry, { status: result.status, finishedAt: new Date().toISOString(), ...result.counts, errors: result.errors });
  }

  async lastSuccessfulSync(studentId: string, provider: ConnectorProvider) {
    const e = this.syncs.get(studentId)?.find((x) => x.provider === provider && (x.status === "success" || x.status === "partial"));
    return e ? { ...e } : null;
  }

  async listSyncs(studentId: string, limit: number) {
    return (this.syncs.get(studentId) ?? []).slice(0, limit).map((e) => ({ ...e }));
  }
}
