import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { AttendanceInputError } from "@upes/core";
import { ConnectorError } from "@upes/connectors";
import { registerRoutes, type RouteDeps } from "./routes";

export interface BuildOptions extends RouteDeps {
  corsOrigins?: string[];
  logger?: boolean;
  rateLimitPerMinute?: number;
}

export async function buildApp(opts: BuildOptions) {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(helmet);
  await app.register(cors, { origin: opts.corsOrigins ?? false, credentials: true });
  await app.register(rateLimit, { max: opts.rateLimitPerMinute ?? 120, timeWindow: "1 minute" });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "invalid_input",
        message: "Some fields are invalid.",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (err instanceof AttendanceInputError) {
      return reply.code(400).send({ error: "invalid_input", message: err.message });
    }
    if (err instanceof ConnectorError) {
      return reply.code(502).send({ error: "upstream_error", message: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({
      error: status === 429 ? "rate_limited" : "server_error",
      message: status >= 500 ? "Something went wrong on our side. Try again shortly." : (err as Error).message,
    });
  });

  await registerRoutes(app, opts);
  return app;
}
