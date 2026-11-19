import { loadConfig } from "./config";
import { buildApp } from "./app";
import { createSupabaseVerifier } from "./plugins/auth";
import { InMemoryRepository } from "./repositories/memory";
import { createOpenAiPolicyAnswerer } from "./services/policy-answer";

async function main() {
  const config = loadConfig();

  // Use Postgres when DATABASE_URL is set; otherwise fall back to memory (data is lost on restart).
  let repo;
  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaAcademicRepository } = await import("./repositories/prisma");
    repo = new PrismaAcademicRepository(new PrismaClient());
  } else {
    console.warn("DATABASE_URL not set: using the in-memory repository. Data will not persist.");
    repo = new InMemoryRepository();
  }

  const app = await buildApp({
    repo,
    verify: createSupabaseVerifier(config),
    corsOrigins: config.corsOrigins,
    logger: true,
    ...(config.openAiApiKey && config.openAiModel ? { answerPolicy: createOpenAiPolicyAnswerer(config.openAiApiKey, config.openAiModel) } : {}),
  });
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
