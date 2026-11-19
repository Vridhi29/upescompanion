import { describe, expect, it } from "vitest";
import { AcademicInputError, checkPlacement, configuredReminderTimes, gpa, nextConfiguredReminderAt, parseReminderOffsets, projectCgpa, ReminderOffsetInputError, requiredAssessmentPercent, retrievePolicyExcerpts, weightedAssessmentPercent } from "../src";

describe("academic calculations", () => {
  it("computes weight-normalized internal assessment percent", () => {
    expect(weightedAssessmentPercent([
      { name: "Quiz", obtained: 8, maximum: 10, weight: 20 },
      { name: "Midterm", obtained: 40, maximum: 50, weight: 80 },
    ])).toBe(80);
  });
  it("calculates the required remaining assessment score without inventing a grade boundary", () => {
    expect(requiredAssessmentPercent(70, 40, 60, 75)).toBeCloseTo(78.3333333);
    expect(requiredAssessmentPercent(70, 100, 0, 75)).toBeNull();
  });
  it("rejects invalid marks and calculates credit weighted GPA", () => {
    expect(() => weightedAssessmentPercent([{ name: "quiz", obtained: 11, maximum: 10, weight: 1 }])).toThrow(AcademicInputError);
    expect(() => weightedAssessmentPercent([{ name: "quiz", obtained: 5, maximum: 10, weight: 101 }])).toThrow(AcademicInputError);
    expect(gpa([{ course: "A", credits: 4, gradePoints: 8 }, { course: "B", credits: 2, gradePoints: 10 }])).toBeCloseTo(8.6666667);
  });
  it("projects CGPA using entered quality points", () => {
    expect(projectCgpa({ credits: 20, points: 160 }, { credits: 20, points: 180 })).toBe(8.5);
  });
  it("does not assert placement eligibility from unverified rules", () => {
    expect(checkPlacement({ minCgpa: 7, verified: false }, { cgpa: 9 })).toBe("unknown");
    expect(checkPlacement({ minCgpa: 7, verified: true }, {})).toBe("unknown");
    expect(checkPlacement({ minCgpa: 7, maxActiveBacklogs: 0, verified: true }, { cgpa: 8, activeBacklogs: 0 })).toBe("eligible");
    expect(checkPlacement({ minCgpa: 7, verified: true }, { cgpa: 6.9 })).toBe("not_eligible");
    expect(checkPlacement({ minPercent: 101, verified: true }, { percent: 100 })).toBe("unknown");
    expect(checkPlacement({ maxActiveBacklogs: 1, verified: true }, { activeBacklogs: 1.5 })).toBe("unknown");
  });
  it("chooses the next future configured assignment reminder", () => {
    const now = Date.parse("2026-11-13T00:00:00.000Z");
    expect(nextConfiguredReminderAt("2026-11-15T12:00:00.000Z", [1440, 180, 60], now)).toBe("2026-11-14T12:00:00.000Z");
    expect(nextConfiguredReminderAt("2026-11-13T02:00:00.000Z", [1440, 180, 60], now)).toBe("2026-11-13T01:00:00.000Z");
    expect(nextConfiguredReminderAt("2026-11-13T00:30:00.000Z", [1440, 180, 60], now)).toBeNull();
    expect(configuredReminderTimes("2026-11-15T12:00:00.000Z", [60, 1440, 180, 60], now)).toEqual([
      "2026-11-14T12:00:00.000Z",
      "2026-11-15T09:00:00.000Z",
      "2026-11-15T11:00:00.000Z",
    ]);
  });
  it("validates reminder offsets using the notification API limits", () => {
    expect(parseReminderOffsets(" 1440, 180,60 ")).toEqual([1440, 180, 60]);
    expect(parseReminderOffsets("   ")).toEqual([]);
    expect(() => parseReminderOffsets("1, 1.5")).toThrow(ReminderOffsetInputError);
    expect(() => parseReminderOffsets("0")).toThrow(ReminderOffsetInputError);
    expect(() => parseReminderOffsets("43201")).toThrow(ReminderOffsetInputError);
    expect(() => parseReminderOffsets("1,2,3,4,5,6,7,8,9,10,11")).toThrow(ReminderOffsetInputError);
  });
  it("retrieves ranked policy excerpts with source citations and no unsupported result", () => {
    const sources = [
      { title: "Student Handbook", version: "2026", url: "https://example.edu/handbook", content: "Students should attend all classes. Minimum attendance for examination eligibility is 75 percent." },
      { title: "Academic Calendar", content: "The semester begins in August." },
    ];
    const results = retrievePolicyExcerpts(sources, "What is the minimum attendance for examination eligibility?");
    expect(results[0]).toMatchObject({ source: "Student Handbook", version: "2026", url: "https://example.edu/handbook" });
    expect(results[0]?.excerpt).toContain("Minimum attendance");
    expect(retrievePolicyExcerpts(sources, "when does vacation start")).toEqual([]);
    expect(retrievePolicyExcerpts(sources, "the is and")).toEqual([]);
  });
});
