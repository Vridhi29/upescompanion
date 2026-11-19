import { randomUUID } from "node:crypto";
import type { PrismaClient, Student } from "@prisma/client";
import { StudentAcademicRecordInput, type AcademicTaskStatus, type AssignmentCreateInput, type AttendanceSummaryDto, type BacklogStatus, type ConnectorProvider, type DataSource, type DirectedReadingStatus, type NotificationPreferencesInput, type StudentAcademicRecordInput as StudentAcademicRecordPayload, type StudentProfile } from "@upes/schemas";
import { gpa, type PolicySource } from "@upes/core";
import type {
  AcademicRepository,
  AttendanceRow,
  StudentRecord,
  SyncLogEntry,
  SyncStatus,
  UpsertCounts,
  AssignmentRecord,
  BacklogRecord,
  DirectedReadingRecord,
  AcademicRecordRecord,
  PlacementRuleRecord,
} from "./types";

function toStudent(s: Student): StudentRecord {
  return {
    id: s.id,
    email: s.email,
    name: s.name,
    universityId: s.universityId,
    department: s.department,
    degree: s.degree,
    specialization: s.specialization,
    batch: s.batch,
    currentSemester: s.currentSemester,
    academicYear: s.academicYear,
    attendanceTarget: s.attendanceTarget,
  };
}

function toAssignment(assignment: { id: string; title: string; courseCode: string | null; description: string | null; dueAt: Date | null; source: DataSource }, task: { status: AcademicTaskStatus }): AssignmentRecord {
  return { id: assignment.id, title: assignment.title, courseCode: assignment.courseCode, description: assignment.description, dueAt: assignment.dueAt?.toISOString() ?? null, status: task.status, source: assignment.source };
}

function toBacklog(row: { id: string; originalSemester: number; attempts: number; status: BacklogStatus; source: DataSource; course: { code: string; name: string } }): BacklogRecord {
  return { id: row.id, courseCode: row.course.code, courseName: row.course.name, originalSemester: row.originalSemester, attempts: row.attempts, status: row.status, source: row.source };
}

function toNotificationPreferences(row: { quietStart: string | null; quietEnd: string | null; channels: unknown; reminderOffsetsMinutes: unknown }): NotificationPreferencesInput {
  const channels = Array.isArray(row.channels) ? row.channels.filter((x): x is NotificationPreferencesInput["channels"][number] => typeof x === "string") : [];
  const reminderOffsetsMinutes = Array.isArray(row.reminderOffsetsMinutes) ? row.reminderOffsetsMinutes.filter((x): x is number => typeof x === "number") : [];
  return { quietStart: row.quietStart, quietEnd: row.quietEnd, channels, reminderOffsetsMinutes };
}

function toAcademicRecord(row: { semester: number; sgpa: number | null; payload: unknown; source: DataSource; createdAt: Date }): AcademicRecordRecord {
  const parsed = StudentAcademicRecordInput.safeParse(row.payload);
  const payload: StudentAcademicRecordPayload = parsed.success ? parsed.data : { semester: row.semester, assessments: [], courses: [] };
  return { semester: row.semester, sgpa: row.sgpa, payload, source: row.source, savedAt: row.createdAt.toISOString() };
}

/**
 * Postgres implementation. NOTE: the API's DB role bypasses RLS, so every query here is
 * explicitly filtered by studentId. Keep it that way.
 *
 * Shared reference data (courses) is created if missing but NEVER modified from a student's
 * sync, so one student's data cannot alter what other students see.
 */
export class PrismaAcademicRepository implements AcademicRepository {
  constructor(private readonly db: PrismaClient) {}

  async ensureStudent(user: { id: string; email: string }) {
    const s = await this.db.student.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, email: user.email },
    });
    return toStudent(s);
  }

  async getStudent(studentId: string) {
    const s = await this.db.student.findUnique({ where: { id: studentId } });
    return s ? toStudent(s) : null;
  }

  async updateProfile(studentId: string, p: StudentProfile) {
    await this.db.student.update({
      where: { id: studentId },
      data: {
        name: p.name,
        universityId: p.studentId,
        department: p.department,
        degree: p.degree,
        specialization: p.specialization,
        batch: p.batch,
        currentSemester: p.currentSemester,
        academicYear: p.academicYear,
      },
    });
  }

  async listAssignments(studentId: string): Promise<AssignmentRecord[]> {
    const tasks = await this.db.academicTask.findMany({
      where: { studentId, assignmentId: { not: null } },
      include: { assignment: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
    return tasks.flatMap((task) => task.assignment ? [toAssignment(task.assignment, task)] : []);
  }

  async createAssignment(studentId: string, input: AssignmentCreateInput): Promise<AssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          studentId, externalId: `manual:${randomUUID()}`, title: input.title,
          courseCode: input.courseCode ?? null, description: input.description ?? null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null, source: "manual",
        },
      });
      const task = await tx.academicTask.create({
        data: {
          studentId, assignmentId: assignment.id, title: input.title,
          dueAt: input.dueAt ? new Date(input.dueAt) : null, status: input.status,
        },
      });
      return toAssignment(assignment, task);
    });
  }

  async updateAssignmentStatus(studentId: string, assignmentId: string, status: AcademicTaskStatus): Promise<AssignmentRecord | null> {
    const task = await this.db.academicTask.findFirst({
      where: { studentId, assignmentId }, include: { assignment: true },
    });
    if (!task?.assignment) return null;
    const updated = await this.db.academicTask.update({ where: { id: task.id }, data: { status } });
    return toAssignment(task.assignment, updated);
  }

  async deleteManualAssignment(studentId: string, assignmentId: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const assignment = await tx.assignment.findFirst({
        where: { id: assignmentId, studentId, source: "manual" },
        select: { id: true },
      });
      if (!assignment) return false;
      const task = await tx.academicTask.findFirst({
        where: { studentId, assignmentId },
        select: { id: true },
      });
      if (task) {
        await tx.assignmentAlarm.deleteMany({ where: { studentId, taskId: task.id } });
        await tx.academicTask.delete({ where: { id: task.id } });
      }
      await tx.assignment.delete({ where: { id: assignment.id } });
      return true;
    });
  }

  async listDirectedReadings(studentId: string): Promise<DirectedReadingRecord[]> {
    const rows = await this.db.directedReading.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({ id: row.id, courseCode: row.courseCode, facultyGuide: row.facultyGuide, status: row.status, createdAt: row.createdAt.toISOString() }));
  }

  async createDirectedReading(studentId: string, input: { courseCode: string; facultyGuide?: string | null; status: DirectedReadingStatus }): Promise<DirectedReadingRecord> {
    const row = await this.db.directedReading.create({ data: { studentId, courseCode: input.courseCode, facultyGuide: input.facultyGuide ?? null, status: input.status } });
    return { id: row.id, courseCode: row.courseCode, facultyGuide: row.facultyGuide, status: row.status, createdAt: row.createdAt.toISOString() };
  }

  async updateDirectedReadingStatus(studentId: string, id: string, status: DirectedReadingStatus): Promise<DirectedReadingRecord | null> {
    const row = await this.db.directedReading.findFirst({ where: { id, studentId } });
    if (!row) return null;
    const updated = await this.db.directedReading.update({ where: { id }, data: { status } });
    return { id: updated.id, courseCode: updated.courseCode, facultyGuide: updated.facultyGuide, status: updated.status, createdAt: updated.createdAt.toISOString() };
  }

  async listBacklogs(studentId: string): Promise<BacklogRecord[]> {
    const rows = await this.db.backlog.findMany({ where: { studentId }, include: { course: true }, orderBy: { createdAt: "desc" } });
    return rows.map(toBacklog);
  }

  async createBacklog(studentId: string, input: { courseCode: string; courseName: string; originalSemester: number; attempts: number }): Promise<BacklogRecord> {
    const row = await this.db.$transaction(async (tx) => {
      const course = await tx.course.upsert({ where: { code: input.courseCode }, update: {}, create: { code: input.courseCode, name: input.courseName, credits: 0 } });
      return tx.backlog.upsert({
        where: { studentId_courseId: { studentId, courseId: course.id } },
        update: {},
        create: { studentId, courseId: course.id, originalSemester: input.originalSemester, attempts: input.attempts, status: "pending", source: "manual" },
        include: { course: true },
      });
    });
    return toBacklog(row);
  }

  async updateBacklogStatus(studentId: string, id: string, status: BacklogStatus): Promise<BacklogRecord | null> {
    const row = await this.db.backlog.findFirst({ where: { id, studentId }, include: { course: true } });
    if (!row) return null;
    const updated = await this.db.backlog.update({ where: { id }, data: { status }, include: { course: true } });
    return toBacklog(updated);
  }

  async getNotificationPreferences(studentId: string): Promise<NotificationPreferencesInput | null> {
    const row = await this.db.notificationPreference.findUnique({ where: { studentId } });
    return row ? toNotificationPreferences(row) : null;
  }

  async saveNotificationPreferences(studentId: string, input: NotificationPreferencesInput): Promise<NotificationPreferencesInput> {
    const row = await this.db.notificationPreference.upsert({
      where: { studentId },
      create: { studentId, quietStart: input.quietStart, quietEnd: input.quietEnd, channels: input.channels, reminderOffsetsMinutes: input.reminderOffsetsMinutes },
      update: { quietStart: input.quietStart, quietEnd: input.quietEnd, channels: input.channels, reminderOffsetsMinutes: input.reminderOffsetsMinutes },
    });
    return toNotificationPreferences(row);
  }

  async listAcademicRecords(studentId: string): Promise<AcademicRecordRecord[]> {
    const rows = await this.db.transcript.findMany({ where: { studentId }, orderBy: { semester: "desc" } });
    return rows.map(toAcademicRecord);
  }

  async saveAcademicRecord(studentId: string, input: StudentAcademicRecordPayload): Promise<AcademicRecordRecord> {
    const saved = await this.db.transcript.upsert({
      where: { studentId_semester: { studentId, semester: input.semester } },
      create: { studentId, semester: input.semester, sgpa: gpa(input.courses), payload: input, source: "manual" },
      update: { sgpa: gpa(input.courses), payload: input, source: "manual" },
    });
    return toAcademicRecord(saved);
  }

  async searchPolicySources(terms: string[]): Promise<PolicySource[]> {
    const uniqueTerms = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 3))].slice(0, 8);
    if (!uniqueTerms.length) return [];
    const documents = await this.db.policyDocument.findMany({
      where: {
        officialUrl: { not: null },
        supersededById: null,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
      },
      select: { id: true, title: true, version: true, officialUrl: true },
      take: 1_000,
    });
    if (!documents.length) return [];
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const chunks = await this.db.policyChunk.findMany({
      where: {
        documentId: { in: documents.map((document) => document.id) },
        OR: uniqueTerms.map((term) => ({ content: { contains: term, mode: "insensitive" as const } })),
      },
      select: {
        documentId: true,
        content: true,
        page: true,
        clause: true,
      },
      take: 250,
    });
    return chunks.flatMap((chunk) => {
      const document = documentById.get(chunk.documentId);
      if (!document?.officialUrl) return [];
      return [{
        title: document.title,
        version: document.version,
        url: document.officialUrl,
        locator: chunk.clause ? `Clause ${chunk.clause}` : chunk.page != null ? `Page ${chunk.page}` : null,
        sourceType: "account" as const,
        content: chunk.content,
      }];
    });
  }

  async listVerifiedPlacementRules(studentId: string): Promise<PlacementRuleRecord[]> {
    const student = await this.db.student.findUnique({ where: { id: studentId }, select: { batch: true } });
    const batchScope = student?.batch ? [{ batch: student.batch }] : [];
    const documents = await this.db.policyDocument.findMany({
      where: {
        officialUrl: { not: null },
        supersededById: null,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
        AND: [{ OR: [{ batch: null }, ...batchScope] }],
      },
      select: { id: true, title: true, version: true, officialUrl: true, batch: true },
      take: 1_000,
    });
    if (!documents.length) return [];
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const rules = await this.db.placementRule.findMany({
      where: { verified: true, sourceDocumentId: { in: documents.map((document) => document.id) } },
      select: { id: true, company: true, minCgpa: true, maxActiveBacklogs: true, minPercent: true, sourceDocumentId: true },
      take: 500,
    });
    return rules.flatMap((rule) => {
      const document = rule.sourceDocumentId ? documentById.get(rule.sourceDocumentId) : undefined;
      if (!document?.officialUrl) return [];
      return [{
        id: rule.id,
        company: rule.company,
        minCgpa: rule.minCgpa,
        maxActiveBacklogs: rule.maxActiveBacklogs,
        minPercent: rule.minPercent,
        sourceTitle: document.title,
        sourceVersion: document.version,
        sourceUrl: document.officialUrl,
        sourceBatch: document.batch,
      }];
    });
  }

  async listAttendance(studentId: string): Promise<AttendanceRow[]> {
    const rows = await this.db.attendanceSummary.findMany({
      where: { studentId },
      include: { enrollment: { include: { course: true } } },
      orderBy: { enrollment: { course: { code: "asc" } } },
    });
    return rows.map((r) => ({
      courseCode: r.enrollment.course.code,
      courseName: r.enrollment.course.name,
      attended: r.attended,
      conducted: r.conducted,
      asOf: r.asOf.toISOString(),
      source: r.source,
    }));
  }

  async upsertAttendance(studentId: string, rows: AttendanceSummaryDto[], source: DataSource): Promise<UpsertCounts> {
    return this.db.$transaction(async (tx) => {
      const student = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
      const academicYear = student.academicYear ?? "unknown";
      const number = student.currentSemester ?? 0;
      const semester = await tx.semester.upsert({
        where: { academicYear_number: { academicYear, number } },
        update: {},
        create: { academicYear, number },
      });
      const counts = { created: 0, updated: 0, unchanged: 0 };
      for (const r of rows) {
        const course = await tx.course.upsert({
          where: { code: r.courseCode },
          update: {},
          create: { code: r.courseCode, name: r.courseName, credits: 0 },
        });
        const enrollment = await tx.enrollment.upsert({
          where: { studentId_courseId_semesterId: { studentId, courseId: course.id, semesterId: semester.id } },
          update: {},
          create: { studentId, courseId: course.id, semesterId: semester.id, source },
        });
        const prev = await tx.attendanceSummary.findUnique({ where: { enrollmentId: enrollment.id } });
        const asOf = new Date(r.asOf);
        if (!prev) {
          await tx.attendanceSummary.create({
            data: { studentId, enrollmentId: enrollment.id, attended: r.attended, conducted: r.conducted, asOf, source },
          });
          counts.created++;
        } else if (prev.attended === r.attended && prev.conducted === r.conducted) {
          counts.unchanged++;
        } else {
          await tx.attendanceSummary.update({
            where: { enrollmentId: enrollment.id },
            data: { attended: r.attended, conducted: r.conducted, asOf, source },
          });
          counts.updated++;
        }
      }
      return counts;
    });
  }

  async startSync(studentId: string, provider: ConnectorProvider, source: DataSource) {
    const log = await this.db.syncLog.create({ data: { studentId, provider, source, status: "running" } });
    return log.id;
  }

  async finishSync(
    studentId: string,
    syncId: string,
    result: { status: Exclude<SyncStatus, "running">; counts: UpsertCounts; errors: string[] },
  ) {
    await this.db.syncLog.updateMany({
      where: { id: syncId, studentId },
      data: { status: result.status, finishedAt: new Date(), ...result.counts, errors: result.errors },
    });
  }

  private toEntry(l: {
    id: string; provider: string; source: DataSource; status: SyncStatus; startedAt: Date;
    finishedAt: Date | null; created: number; updated: number; unchanged: number; errors: unknown;
  }): SyncLogEntry {
    return {
      id: l.id,
      provider: l.provider as ConnectorProvider,
      source: l.source,
      status: l.status,
      startedAt: l.startedAt.toISOString(),
      finishedAt: l.finishedAt?.toISOString() ?? null,
      created: l.created,
      updated: l.updated,
      unchanged: l.unchanged,
      errors: Array.isArray(l.errors) ? (l.errors as string[]) : [],
    };
  }

  async lastSuccessfulSync(studentId: string, provider: ConnectorProvider) {
    const l = await this.db.syncLog.findFirst({
      where: { studentId, provider, status: { in: ["success", "partial"] } },
      orderBy: { startedAt: "desc" },
    });
    return l ? this.toEntry(l) : null;
  }

  async listSyncs(studentId: string, limit: number) {
    const rows = await this.db.syncLog.findMany({ where: { studentId }, orderBy: { startedAt: "desc" }, take: limit });
    return rows.map((l) => this.toEntry(l));
  }
}
