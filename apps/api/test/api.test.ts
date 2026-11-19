import { describe, expect, it } from "vitest";
import { ConnectorError, type UpesPortalConnector } from "@upes/connectors";
import { createSupabaseVerifier } from "../src/plugins/auth";
import { bearer, makeApp, signToken, USER_A, USER_B } from "./helpers";

const SECRET = "test-secret-at-least-16-chars";

describe("auth", () => {
  it("rejects missing and invalid tokens", async () => {
    const { app } = await makeApp();
    expect((await app.inject({ method: "GET", url: "/v1/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: bearer("nope") })).statusCode).toBe(401);
  });

  it("health is public", async () => {
    const { app } = await makeApp();
    expect((await app.inject({ method: "GET", url: "/v1/health" })).statusCode).toBe(200);
  });

  it("verifies real HS256 tokens, rejecting expired and wrong-audience ones", async () => {
    const verify = createSupabaseVerifier({ jwtSecret: SECRET });
    const good = await signToken(SECRET, USER_A.id);
    await expect(verify(good)).resolves.toMatchObject({ id: USER_A.id });
    await expect(verify(await signToken(SECRET, USER_A.id, { exp: "-1h" }))).rejects.toThrow();
    await expect(verify(await signToken(SECRET, USER_A.id, { aud: "other" }))).rejects.toThrow();
    await expect(verify(await signToken("different-secret-16-chars!", USER_A.id))).rejects.toThrow();
  });
});

describe("attendance calculate", () => {
  it("returns bunk/recovery/projection", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/attendance/calculate",
      headers: bearer("token-a"),
      payload: { attended: 36, conducted: 40, target: 75, plan: { attend: 4, miss: 4 } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe("projection");
    expect(body.canMiss).toBe(8);
    expect(body.projected.counts).toEqual({ attended: 40, conducted: 48 });
  });

  it("explains invalid input", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/attendance/calculate",
      headers: bearer("token-a"),
      payload: { attended: 50, conducted: 40, target: 75 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/cannot exceed/);
  });
});

describe("student profile", () => {
  it("saves and returns the authenticated student's profile, including degree", async () => {
    const { app } = await makeApp();
    const response = await app.inject({
      method: "PUT", url: "/v1/me", headers: bearer("token-a"),
      payload: { studentId: "UPES-123", name: "Example Student", department: "Computer Science", degree: "B.Tech", specialization: "AI", batch: "2024", currentSemester: 5, academicYear: "2026-27" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().student).toMatchObject({ universityId: "UPES-123", degree: "B.Tech", currentSemester: 5 });
  });
  it("validates profile fields", async () => {
    const { app } = await makeApp();
    const response = await app.inject({ method: "PUT", url: "/v1/me", headers: bearer("token-a"), payload: { name: "" } });
    expect(response.statusCode).toBe(400);
  });
});

describe("manual assignments", () => {
  it("creates, lists, and updates an assignment within its owner account", async () => {
    const { app } = await makeApp();
    const created = await app.inject({
      method: "POST", url: "/v1/assignments", headers: bearer("token-a"),
      payload: { title: "Lab report", courseCode: "CS101", dueAt: "2026-11-15T12:00:00.000Z" },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().assignment.id as string;
    expect(created.json().assignment).toMatchObject({ title: "Lab report", source: "manual", status: "new" });
    const listA = await app.inject({ method: "GET", url: "/v1/assignments", headers: bearer("token-a") });
    const listB = await app.inject({ method: "GET", url: "/v1/assignments", headers: bearer("token-b") });
    expect(listA.json().assignments).toHaveLength(1);
    expect(listB.json().assignments).toHaveLength(0);
    const updated = await app.inject({ method: "PATCH", url: `/v1/assignments/${id}`, headers: bearer("token-a"), payload: { status: "completed" } });
    expect(updated.json().assignment.status).toBe("completed");
    const overdue = await app.inject({ method: "PATCH", url: `/v1/assignments/${id}`, headers: bearer("token-a"), payload: { status: "overdue" } });
    expect(overdue.json().assignment.status).toBe("overdue");
    expect((await app.inject({ method: "PATCH", url: `/v1/assignments/${id}`, headers: bearer("token-b"), payload: { status: "completed" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/v1/assignments/${id}`, headers: bearer("token-b") })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/v1/assignments/${id}`, headers: bearer("token-a") })).json()).toEqual({ deleted: true });
    expect((await app.inject({ method: "GET", url: "/v1/assignments", headers: bearer("token-a") })).json().assignments).toHaveLength(0);
    expect((await app.inject({ method: "DELETE", url: `/v1/assignments/${id}`, headers: bearer("token-a") })).statusCode).toBe(404);
  });
});

describe("manual academic planning records", () => {
  it("isolates Directed Reading and backlog records by student", async () => {
    const { app } = await makeApp();
    const dr = await app.inject({ method: "POST", url: "/v1/directed-reading", headers: bearer("token-a"), payload: { courseCode: "CS201", facultyGuide: "Guide" } });
    expect(dr.statusCode).toBe(201);
    const drId = dr.json().application.id as string;
    expect((await app.inject({ method: "GET", url: "/v1/directed-reading", headers: bearer("token-b") })).json().applications).toHaveLength(0);
    expect((await app.inject({ method: "PATCH", url: `/v1/directed-reading/${drId}`, headers: bearer("token-a"), payload: { status: "submitted" } })).json().application.status).toBe("submitted");
    expect((await app.inject({ method: "PATCH", url: `/v1/directed-reading/${drId}`, headers: bearer("token-b"), payload: { status: "completed" } })).statusCode).toBe(404);

    const backlog = await app.inject({ method: "POST", url: "/v1/backlogs", headers: bearer("token-a"), payload: { courseCode: "CS101", courseName: "Data Structures", originalSemester: 2, attempts: 1 } });
    expect(backlog.statusCode).toBe(201);
    const backlogId = backlog.json().backlog.id as string;
    expect(backlog.json().backlog).toMatchObject({ source: "manual", status: "pending", courseCode: "CS101" });
    const duplicateBacklog = await app.inject({ method: "POST", url: "/v1/backlogs", headers: bearer("token-a"), payload: { courseCode: "CS101", courseName: "Different title", originalSemester: 4, attempts: 3 } });
    expect(duplicateBacklog.json().backlog).toMatchObject({ id: backlogId, courseName: "Data Structures", originalSemester: 2, attempts: 1 });
    expect((await app.inject({ method: "GET", url: "/v1/backlogs", headers: bearer("token-a") })).json().backlogs).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/v1/backlogs", headers: bearer("token-b") })).json().backlogs).toHaveLength(0);
    expect((await app.inject({ method: "PATCH", url: `/v1/backlogs/${backlogId}`, headers: bearer("token-a"), payload: { status: "cleared" } })).json().backlog.status).toBe("cleared");
    expect((await app.inject({ method: "PATCH", url: `/v1/backlogs/${backlogId}`, headers: bearer("token-b"), payload: { status: "cleared" } })).statusCode).toBe(404);
  });

  it("saves notification preferences per account", async () => {
    const { app } = await makeApp();
    const saved = await app.inject({ method: "PUT", url: "/v1/notification-preferences", headers: bearer("token-a"), payload: { quietStart: "22:00", quietEnd: "07:00", channels: ["in_app", "alarm", "local"], reminderOffsetsMinutes: [1440, 60] } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().preferences).toMatchObject({ quietStart: "22:00", quietEnd: "07:00", channels: ["in_app", "alarm", "local"], reminderOffsetsMinutes: [1440, 60] });
    expect((await app.inject({ method: "GET", url: "/v1/notification-preferences", headers: bearer("token-b") })).json().preferences).toBeNull();
  });

  it("persists validated student academic records per semester", async () => {
    const { app } = await makeApp();
    const body = { semester: 3, assessments: [{ name: "Midterm", obtained: 42, maximum: 50, weight: 40 }], courses: [{ course: "CS101", credits: 4, gradePoints: 8.5 }] };
    const saved = await app.inject({ method: "PUT", url: "/v1/academics/records", headers: bearer("token-a"), payload: body });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().record).toMatchObject({ semester: 3, sgpa: 8.5, source: "manual", payload: body });
    expect((await app.inject({ method: "GET", url: "/v1/academics/records", headers: bearer("token-a") })).json().records).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/v1/academics/records", headers: bearer("token-b") })).json().records).toHaveLength(0);
    const invalid = await app.inject({ method: "PUT", url: "/v1/academics/records", headers: bearer("token-a"), payload: { ...body, assessments: [{ name: "Invalid", obtained: 60, maximum: 50, weight: 50 }] } });
    expect(invalid.statusCode).toBe(400);
  });
});

describe("sync + student data isolation", () => {
  it("syncs mock data, labels it as mock, and keeps students separate", async () => {
    const { app } = await makeApp();
    const sync = await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    expect(sync.statusCode).toBe(200);
    expect(sync.json()).toMatchObject({ status: "success", counts: { created: 5 } });

    const a = (await app.inject({ method: "GET", url: "/v1/attendance", headers: bearer("token-a") })).json();
    expect(a.subjects).toHaveLength(5);
    expect(a.subjects.every((s: { source: string }) => s.source === "mock")).toBe(true);
    expect(a.lastSuccessfulSync).not.toBeNull();

    const b = (await app.inject({ method: "GET", url: "/v1/attendance", headers: bearer("token-b") })).json();
    expect(b.subjects).toHaveLength(0);
    expect(b.lastSuccessfulSync).toBeNull();

    const historyB = (await app.inject({ method: "GET", url: "/v1/sync/history", headers: bearer("token-b") })).json();
    expect(historyB.syncs).toHaveLength(0);
  });

  it("is idempotent: syncing twice creates no duplicates", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    const second = (await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") })).json();
    expect(second.counts).toEqual({ created: 0, updated: 0, unchanged: 5 });
  });

  it("moodle sync is honestly reported as not implemented", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/v1/sync/moodle", headers: bearer("token-a") });
    expect(res.statusCode).toBe(501);
  });
});

function connector(rows: unknown[] | (() => Promise<unknown[]>), asOf = new Date().toISOString()): UpesPortalConnector {
  return {
    id: "test",
    source: "synced",
    fetchProfile: async () => ({
      source: "synced",
      fetchedAt: asOf,
      data: { studentId: "S1", name: "Test", department: null, degree: null, specialization: null, batch: null, currentSemester: 1, academicYear: "2026-27" },
    }),
    fetchAttendance: async () => ({
      source: "synced",
      fetchedAt: asOf,
      data: typeof rows === "function" ? await rows() : rows,
    }),
  };
}
const row = (code: string, attended: number, conducted: number, asOf = new Date().toISOString()) => ({
  courseCode: code, courseName: code, attended, conducted, asOf,
});

describe("sync safety rules", () => {
  it("never replaces good data with an empty or failed sync", async () => {
    const good = connector([row("C1", 30, 40)]);
    const { app, repo } = await makeApp({ createUpesConnector: () => good });
    await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });

    const empty = connector([]);
    const { app: app2 } = await makeApp({ repo, createUpesConnector: () => empty });
    const res = await app2.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    expect(res.statusCode).toBe(502);
    expect(res.json().status).toBe("failed");
    expect(await repo.listAttendance(USER_A.id)).toHaveLength(1);
  });

  it("rejects invalid rows but keeps valid ones (partial)", async () => {
    const c = connector([row("OK", 10, 12), row("BAD", 20, 10)]);
    const { app, repo } = await makeApp({ createUpesConnector: () => c });
    const res = await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    expect(res.json().status).toBe("partial");
    const stored = await repo.listAttendance(USER_A.id);
    expect(stored.map((r) => r.courseCode)).toEqual(["OK"]);
  });

  it("ignores rows whose totals went backwards or are older than stored", async () => {
    const t1 = "2026-11-10T00:00:00.000Z";
    const { app, repo } = await makeApp({ createUpesConnector: () => connector([row("C1", 30, 40, t1)]) });
    await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });

    const { app: back } = await makeApp({ repo, createUpesConnector: () => connector([row("C1", 10, 20, "2026-11-11T00:00:00.000Z")]) });
    await back.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    const { app: old } = await makeApp({ repo, createUpesConnector: () => connector([row("C1", 35, 45, "2026-11-01T00:00:00.000Z")]) });
    await old.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });

    const [stored] = await repo.listAttendance(USER_A.id);
    expect(stored).toMatchObject({ attended: 30, conducted: 40 });
  });

  it("retries retryable connector errors, then logs a failure", async () => {
    let calls = 0;
    const flaky = connector(async () => {
      calls++;
      throw new ConnectorError("portal timeout", true);
    });
    const { app, repo } = await makeApp({ createUpesConnector: () => flaky });
    const res = await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    expect(res.statusCode).toBe(502);
    expect(calls).toBe(3);
    const history = await repo.listSyncs(USER_A.id, 5);
    expect(history[0]).toMatchObject({ status: "failed" });
    expect(history[0]!.errors[0]).toMatch(/timeout/);
  });

  it("does not retry non-retryable errors", async () => {
    let calls = 0;
    const denied = connector(async () => {
      calls++;
      throw new ConnectorError("access denied", false);
    });
    const { app } = await makeApp({ createUpesConnector: () => denied });
    await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    expect(calls).toBe(1);
  });
});

describe("two users cannot see each other's repository data", () => {
  it("scopes by student id", async () => {
    const { app, repo } = await makeApp();
    await app.inject({ method: "POST", url: "/v1/sync/upes", headers: bearer("token-a") });
    expect(await repo.listAttendance(USER_B.id)).toEqual([]);
  });
});

describe("curated policy retrieval", () => {
  it("requires auth and returns no generated answer when the policy corpus is empty", async () => {
    const { app } = await makeApp();
    const unauthorized = await app.inject({ method: "GET", url: "/v1/policies/search?query=attendance+eligibility" });
    expect(unauthorized.statusCode).toBe(401);
    const response = await app.inject({ method: "GET", url: "/v1/policies/search?query=attendance+eligibility", headers: bearer("token-a") });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ results: [], generated: false });
  });

  it("rejects short policy queries", async () => {
    const { app } = await makeApp();
    const response = await app.inject({ method: "GET", url: "/v1/policies/search?query=hi", headers: bearer("token-a") });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_query");
  });

  it("ranks curated policy chunks and returns citations without generated answers", async () => {
    const { app, repo } = await makeApp();
    repo.seedPolicySources([
      { title: "Academic Handbook", version: "2026", url: "https://policy.example.edu/handbook", locator: "Clause 4.2", content: "Minimum attendance required for examination eligibility is 75 percent." },
      { title: "Term Calendar", version: "2026", url: "https://policy.example.edu/calendar", content: "The fall semester begins in August." },
    ]);
    const response = await app.inject({ method: "GET", url: "/v1/policies/search?query=minimum+attendance+examination+eligibility", headers: bearer("token-a") });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ generated: false, results: [{ source: "Academic Handbook", version: "2026", locator: "Clause 4.2" }] });
    expect(response.json().results[0].excerpt).toContain("75 percent");
  });

  it("generates an answer only from retrieved, numbered evidence when a provider is configured", async () => {
    const { app, repo } = await makeApp({ answerPolicy: async (query, passages) => {
      expect(query).toBe("What is the minimum attendance?");
      expect(passages[0]?.excerpt).toContain("75 percent");
      return "The cited handbook passage sets a 75 percent minimum [1].";
    } });
    repo.seedPolicySources([{ title: "Academic Handbook", version: "2026", url: "https://policy.example.edu/handbook", locator: "Clause 4.2", content: "Minimum attendance required for examination eligibility is 75 percent." }]);
    const response = await app.inject({ method: "POST", url: "/v1/policies/answer", headers: bearer("token-a"), payload: { query: "What is the minimum attendance?" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ generated: true, answerAvailable: true, answer: "The cited handbook passage sets a 75 percent minimum [1].", results: [{ source: "Academic Handbook", locator: "Clause 4.2" }] });
  });

  it("keeps local excerpts out of retrieval unless the student opts in and returns no mock answer", async () => {
    const { app } = await makeApp();
    const unauthorized = await app.inject({ method: "POST", url: "/v1/policies/answer", payload: { query: "What is the minimum attendance?" } });
    expect(unauthorized.statusCode).toBe(401);
    const response = await app.inject({ method: "POST", url: "/v1/policies/answer", headers: bearer("token-a"), payload: {
      query: "What is the minimum attendance?",
      localSources: [{ title: "My notes", content: "Minimum attendance is 75 percent." }],
    } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ answer: null, generated: false, answerAvailable: false, generationError: false, results: [] });
  });

  it("requires explicit opt-in and validates the local excerpt budget", async () => {
    const { app } = await makeApp();
    const response = await app.inject({ method: "POST", url: "/v1/policies/answer", headers: bearer("token-a"), payload: {
      query: "What is the minimum attendance?",
      includeLocal: true,
      localSources: [{ title: "Oversized source", content: "x".repeat(20_001) }],
    } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_query");
  });

  it("includes device excerpts in grounded context only after explicit opt-in", async () => {
    const { app } = await makeApp({ answerPolicy: async (_query, passages) => {
      expect(passages[0]?.sourceType).toBe("local");
      expect(passages[0]?.source).toBe("My notes");
      return "The saved excerpt says 75 percent [1].";
    } });
    const response = await app.inject({ method: "POST", url: "/v1/policies/answer", headers: bearer("token-a"), payload: {
      query: "What is the minimum attendance?",
      includeLocal: true,
      localSources: [{ title: "My notes", content: "Minimum attendance required is 75 percent." }],
    } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ generated: true, results: [{ source: "My notes", sourceType: "local" }] });
  });

  it("limits policy answer requests to ten per minute per client", async () => {
    const { app } = await makeApp();
    const responses = [];
    for (let index = 0; index < 11; index++) {
      responses.push(await app.inject({ method: "POST", url: "/v1/policies/answer", headers: bearer("token-a"), payload: { query: "What is the minimum attendance?" } }));
    }
    expect(responses.slice(0, 10).every((response) => response.statusCode === 200)).toBe(true);
    expect(responses[10]?.statusCode).toBe(429);
  });
});

describe("placement criteria retrieval", () => {
  it("requires auth and returns no invented criteria when none are verified in the database", async () => {
    const { app } = await makeApp();
    const unauthorized = await app.inject({ method: "GET", url: "/v1/placement/rules" });
    expect(unauthorized.statusCode).toBe(401);
    const response = await app.inject({ method: "GET", url: "/v1/placement/rules", headers: bearer("token-a") });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ rules: [] });
  });
});
