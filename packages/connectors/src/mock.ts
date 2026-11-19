import type { StudentProfile } from "@upes/schemas";
import type { ConnectorResult, UpesPortalConnector } from "./index";

/**
 * MOCK DATA. These are invented numbers for development only. They are not real student
 * records and must always be labelled "mock" in the UI.
 */
export const MOCK_ATTENDANCE = [
  { courseCode: "MOCK101", courseName: "Database Management Systems", attended: 38, conducted: 44 },
  { courseCode: "MOCK102", courseName: "Operating Systems", attended: 31, conducted: 42 },
  { courseCode: "MOCK103", courseName: "Computer Networks", attended: 29, conducted: 36 },
  { courseCode: "MOCK104", courseName: "Software Engineering", attended: 24, conducted: 40 },
  { courseCode: "MOCK105", courseName: "Probability and Statistics", attended: 33, conducted: 38 },
] as const;

export class MockUpesConnector implements UpesPortalConnector {
  readonly id = "mock-upes";
  readonly source = "mock" as const;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async fetchProfile(): Promise<ConnectorResult<StudentProfile>> {
    return {
      source: this.source,
      fetchedAt: this.now().toISOString(),
      data: {
        studentId: "MOCK-0000",
        name: "Mock Student",
        department: "Computer Science",
        degree: "B.Tech",
        specialization: "Data Science",
        batch: "2022-2026",
        currentSemester: 7,
        academicYear: "2026-27",
      },
    };
  }

  async fetchAttendance(): Promise<ConnectorResult<unknown[]>> {
    const asOf = this.now().toISOString();
    return {
      source: this.source,
      fetchedAt: asOf,
      data: MOCK_ATTENDANCE.map((r) => ({ ...r, asOf })),
    };
  }
}
