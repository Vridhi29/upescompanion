import type { FastifyInstance } from "fastify";
import {
  alertLevel,
  classesToRecover,
  DEFAULT_TARGETS,
  maxMissable,
  overall,
  percentage,
  policyQueryTerms,
  project,
  retrievePolicyExcerpts,
  summarize,
} from "@upes/core";
import { AssignmentCreateInput, AssignmentStatusInput, AttendanceCalculateInput, BacklogInput, BacklogStatusInput, ConnectorProvider, DirectedReadingInput, DirectedReadingStatusInput, NotificationPreferencesInput, PolicyAnswerInput, PolicySearchInput, StudentAcademicRecordInput, StudentProfile } from "@upes/schemas";
import { MockUpesConnector, type UpesPortalConnector } from "@upes/connectors";
import type { AcademicRepository } from "../repositories/types";
import { requireAuth, type TokenVerifier } from "../plugins/auth";
import { syncUpesPortal, type RetryOptions } from "../services/sync";
import type { PolicyAnswerer } from "../services/policy-answer";

export interface RouteDeps {
  repo: AcademicRepository;
  verify: TokenVerifier;
  /** Factory so tests can inject a failing/empty connector. */
  createUpesConnector?: () => UpesPortalConnector;
  retry?: RetryOptions;
  answerPolicy?: PolicyAnswerer;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps) {
  const { repo } = deps;
  const auth = requireAuth(deps.verify);
  const createUpes = deps.createUpesConnector ?? (() => new MockUpesConnector());

  app.get("/v1/health", async () => ({ status: "ok" }));

  app.get("/v1/me", { preHandler: auth }, async (req) => {
    const u = req.user!;
    const student = await repo.ensureStudent(u);
    const lastSync = await repo.lastSuccessfulSync(u.id, "upes");
    return { student, lastSuccessfulSync: lastSync?.finishedAt ?? null };
  });

  app.put("/v1/me", { preHandler: auth }, async (req, reply) => {
    const user = req.user!;
    const profile = StudentProfile.parse(req.body);
    // Identity is always taken from the verified token; the body cannot edit another student's profile.
    await repo.ensureStudent(user);
    await repo.updateProfile(user.id, { ...profile, studentId: profile.studentId });
    const updated = await repo.getStudent(user.id);
    if (!updated) return reply.code(404).send({ error: "not_found", message: "Student profile not found." });
    return { student: updated };
  });

  app.get("/v1/assignments", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    return { assignments: await repo.listAssignments(user.id) };
  });

  app.post("/v1/assignments", { preHandler: auth }, async (req, reply) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    const input = AssignmentCreateInput.parse(req.body);
    const assignment = await repo.createAssignment(user.id, input);
    return reply.code(201).send({ assignment });
  });

  app.patch("/v1/assignments/:id", { preHandler: auth }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const { status } = AssignmentStatusInput.parse(req.body);
    const assignment = await repo.updateAssignmentStatus(user.id, id, status);
    if (!assignment) return reply.code(404).send({ error: "not_found", message: "Assignment not found." });
    return { assignment };
  });

  app.delete("/v1/assignments/:id", { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await repo.deleteManualAssignment(req.user!.id, id);
    if (!deleted) return reply.code(404).send({ error: "not_found", message: "Manual assignment not found." });
    return { deleted: true };
  });

  app.get("/v1/directed-reading", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    return { applications: await repo.listDirectedReadings(user.id) };
  });

  app.post("/v1/directed-reading", { preHandler: auth }, async (req, reply) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    const input = DirectedReadingInput.parse(req.body);
    const application = await repo.createDirectedReading(user.id, input);
    return reply.code(201).send({ application });
  });

  app.patch("/v1/directed-reading/:id", { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = DirectedReadingStatusInput.parse(req.body);
    const application = await repo.updateDirectedReadingStatus(req.user!.id, id, status);
    if (!application) return reply.code(404).send({ error: "not_found", message: "Directed Reading record not found." });
    return { application };
  });

  app.get("/v1/backlogs", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    return { backlogs: await repo.listBacklogs(user.id) };
  });

  app.post("/v1/backlogs", { preHandler: auth }, async (req, reply) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    const input = BacklogInput.parse(req.body);
    const backlog = await repo.createBacklog(user.id, input);
    return reply.code(201).send({ backlog });
  });

  app.patch("/v1/backlogs/:id", { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = BacklogStatusInput.parse(req.body);
    const backlog = await repo.updateBacklogStatus(req.user!.id, id, status);
    if (!backlog) return reply.code(404).send({ error: "not_found", message: "Backlog record not found." });
    return { backlog };
  });

  app.get("/v1/notification-preferences", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    return { preferences: await repo.getNotificationPreferences(user.id) };
  });

  app.put("/v1/notification-preferences", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    const input = NotificationPreferencesInput.parse(req.body);
    return { preferences: await repo.saveNotificationPreferences(user.id, input) };
  });

  app.get("/v1/academics/records", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    return { records: await repo.listAcademicRecords(user.id) };
  });

  app.put("/v1/academics/records", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    const input = StudentAcademicRecordInput.parse(req.body);
    return { record: await repo.saveAcademicRecord(user.id, input) };
  });

  app.get("/v1/policies/search", { preHandler: auth }, async (req, reply) => {
    const parsed = PolicySearchInput.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_query", message: "Provide a policy search query between 3 and 500 characters." });
    const terms = policyQueryTerms(parsed.data.query);
    const sources = await repo.searchPolicySources(terms);
    return { results: retrievePolicyExcerpts(sources, parsed.data.query), generated: false };
  });

  app.post("/v1/policies/answer", {
    preHandler: auth,
    bodyLimit: 512 * 1024,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = PolicyAnswerInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_query", message: "Provide a policy question and valid optional local excerpts." });
    const { query, includeLocal, localSources } = parsed.data;
    const curated = await repo.searchPolicySources(policyQueryTerms(query));
    const personal = includeLocal ? localSources.map((source) => ({ ...source, sourceType: "local" as const })) : [];
    const results = retrievePolicyExcerpts([...curated, ...personal], query);
    if (!deps.answerPolicy || !results.length) {
      return { answer: null, generated: false, answerAvailable: Boolean(deps.answerPolicy), generationError: false, results };
    }
    try {
      const answer = await deps.answerPolicy(query, results);
      return { answer, generated: true, answerAvailable: true, generationError: false, results };
    } catch {
      return { answer: null, generated: false, answerAvailable: false, generationError: true, results };
    }
  });

  app.get("/v1/placement/rules", { preHandler: auth }, async (req) => {
    const user = req.user!;
    await repo.ensureStudent(user);
    return { rules: await repo.listVerifiedPlacementRules(user.id) };
  });

  app.get("/v1/attendance", { preHandler: auth }, async (req) => {
    const u = req.user!;
    const student = await repo.ensureStudent(u);
    const rows = await repo.listAttendance(u.id);
    const target = student.attendanceTarget;
    const subjects = rows.map((r) => ({
      courseCode: r.courseCode,
      courseName: r.courseName,
      source: r.source,
      asOf: r.asOf,
      ...summarize({ attended: r.attended, conducted: r.conducted }, target),
    }));
    const total = overall(rows.map((r) => ({ attended: r.attended, conducted: r.conducted })));
    const lastSync = await repo.lastSuccessfulSync(u.id, "upes");
    return {
      target,
      targets: DEFAULT_TARGETS,
      overall: {
        ...total,
        canMiss: maxMissable(total.counts, target),
        mustAttend: classesToRecover(total.counts, target),
        alert: alertLevel(total.percentage),
      },
      subjects,
      lastSuccessfulSync: lastSync?.finishedAt ?? null,
      /** Everything above is actual, recorded attendance; projections come from /calculate. */
      kind: "actual" as const,
    };
  });

  app.post("/v1/attendance/calculate", { preHandler: auth }, async (req) => {
    const input = AttendanceCalculateInput.parse(req.body);
    const counts = { attended: input.attended, conducted: input.conducted };
    return {
      kind: "projection" as const,
      current: { percentage: percentage(counts) },
      canMiss: maxMissable(counts, input.target),
      mustAttend: classesToRecover(counts, input.target),
      projected: input.plan ? project(counts, input.plan) : null,
    };
  });

  app.post("/v1/sync/:provider", { preHandler: auth }, async (req, reply) => {
    const provider = ConnectorProvider.safeParse((req.params as { provider: string }).provider);
    if (!provider.success) return reply.code(404).send({ error: "unknown_provider", message: "Provider must be upes or moodle." });
    if (provider.data === "moodle") {
      return reply.code(501).send({
        error: "not_implemented",
        message: "Moodle sync arrives in Phase 4 (assignments). Only the UPES portal connector is available now.",
      });
    }
    const u = req.user!;
    await repo.ensureStudent(u);
    const outcome = await syncUpesPortal({ studentId: u.id, connector: createUpes(), repo, retry: deps.retry });
    return reply.code(outcome.status === "failed" ? 502 : 200).send(outcome);
  });

  app.get("/v1/sync/history", { preHandler: auth }, async (req) => {
    const u = req.user!;
    return { syncs: await repo.listSyncs(u.id, 20) };
  });
}
