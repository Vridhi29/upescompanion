import { z } from "zod";

/** Where a piece of data came from. Shown in the UI so users can tell real data from mock data. */
export const DataSource = z.enum(["synced", "manual", "imported", "mock"]);
export type DataSource = z.infer<typeof DataSource>;

export const ConnectorProvider = z.enum(["upes", "moodle"]);
export type ConnectorProvider = z.infer<typeof ConnectorProvider>;

export const StudentProfile = z.object({
  studentId: z.string().min(1),
  name: z.string().min(1),
  department: z.string().nullable(),
  degree: z.string().nullable(),
  specialization: z.string().nullable(),
  batch: z.string().nullable(),
  currentSemester: z.number().int().min(1).max(16).nullable(),
  academicYear: z.string().nullable(),
});
export type StudentProfile = z.infer<typeof StudentProfile>;

/** One subject's attendance totals as reported by a connector. */
export const AttendanceSummaryDto = z
  .object({
    courseCode: z.string().min(1),
    courseName: z.string().min(1),
    attended: z.number().int().nonnegative(),
    conducted: z.number().int().nonnegative(),
    /** ISO timestamp of when the source reported these totals. */
    asOf: z.string().datetime(),
  })
  .refine((v) => v.attended <= v.conducted, {
    message: "attended cannot exceed conducted",
    path: ["attended"],
  });
export type AttendanceSummaryDto = z.infer<typeof AttendanceSummaryDto>;

export const AttendanceBulkResult = z.object({
  /** Rows that passed validation. */
  valid: z.array(AttendanceSummaryDto),
  /** Human-readable problems for rows that failed validation. */
  errors: z.array(z.string()),
});

/** Request body for POST /v1/attendance/calculate */
export const AttendanceCalculateInput = z.object({
  attended: z.number().int().nonnegative(),
  conducted: z.number().int().nonnegative(),
  target: z.number().gt(0).lte(100).default(80),
  plan: z
    .object({
      attend: z.number().int().nonnegative(),
      miss: z.number().int().nonnegative(),
    })
    .optional(),
});
export type AttendanceCalculateInput = z.infer<typeof AttendanceCalculateInput>;

export const AcademicTaskStatus = z.enum(["new", "pending", "in_progress", "completed", "overdue"]);
export type AcademicTaskStatus = z.infer<typeof AcademicTaskStatus>;

export const AssignmentCreateInput = z.object({
  title: z.string().trim().min(1).max(240),
  courseCode: z.string().trim().max(80).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: AcademicTaskStatus.default("new"),
});
export type AssignmentCreateInput = z.infer<typeof AssignmentCreateInput>;

export const AssignmentStatusInput = z.object({ status: AcademicTaskStatus });

export const DirectedReadingStatus = z.enum(["draft", "submitted", "approved", "rejected", "completed"]);
export type DirectedReadingStatus = z.infer<typeof DirectedReadingStatus>;
export const DirectedReadingInput = z.object({
  courseCode: z.string().trim().min(1).max(80),
  facultyGuide: z.string().trim().max(240).nullable().optional(),
  status: DirectedReadingStatus.default("draft"),
});
export const DirectedReadingStatusInput = z.object({ status: DirectedReadingStatus });

export const BacklogStatus = z.enum(["pending", "registered", "cleared", "directed_reading", "not_eligible"]);
export type BacklogStatus = z.infer<typeof BacklogStatus>;
export const BacklogInput = z.object({
  courseCode: z.string().trim().min(1).max(80),
  courseName: z.string().trim().min(1).max(240),
  originalSemester: z.number().int().min(1).max(16),
  attempts: z.number().int().min(1).max(30).default(1),
});
export const BacklogStatusInput = z.object({ status: BacklogStatus });

export const StudentAcademicRecordInput = z.object({
  semester: z.number().int().min(1).max(16),
  assessments: z.array(z.object({
    name: z.string().trim().min(1).max(160),
    obtained: z.number().nonnegative(),
    maximum: z.number().positive(),
    weight: z.number().nonnegative().max(100),
  }).refine((assessment) => assessment.obtained <= assessment.maximum, { message: "Obtained marks cannot exceed maximum marks." })).max(200),
  courses: z.array(z.object({
    course: z.string().trim().min(1).max(160),
    credits: z.number().positive(),
    gradePoints: z.number().nonnegative(),
  })).max(100),
});
export type StudentAcademicRecordInput = z.infer<typeof StudentAcademicRecordInput>;

export const NotificationPreferencesInput = z.object({
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  channels: z.array(z.enum(["in_app", "web_push", "fcm", "apns", "email", "sms", "local", "alarm"])).max(8),
  reminderOffsetsMinutes: z.array(z.number().int().min(1).max(43_200)).max(10),
});
export type NotificationPreferencesInput = z.infer<typeof NotificationPreferencesInput>;

export const PolicySearchInput = z.object({ query: z.string().trim().min(3).max(500) });
export type PolicySearchInput = z.infer<typeof PolicySearchInput>;
export const PolicyAnswerInput = z.object({
  query: z.string().trim().min(3).max(500),
  includeLocal: z.boolean().default(false),
  localSources: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    version: z.string().max(80).optional(),
    url: z.string().max(2000).optional(),
    locator: z.string().max(240).optional(),
    content: z.string().min(1).max(20_000),
  })).max(20).default([]),
}).superRefine((input, ctx) => {
  const total = input.localSources.reduce((sum, source) => sum + source.content.length, 0);
  if (total > 50_000) ctx.addIssue({ code: "custom", message: "Local policy excerpts are limited to 50,000 characters per request.", path: ["localSources"] });
});
export type PolicyAnswerInput = z.infer<typeof PolicyAnswerInput>;
