import { z } from "zod";

const Env = z.object({
  API_PORT: z.coerce.number().int().default(4000),
  API_CORS_ORIGINS: z.string().default("http://localhost:3000"),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().min(16).optional(),
  UPES_CONNECTOR_MODE: z.enum(["mock"]).default("mock"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).optional(),
});

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  jwksUrl?: string;
  jwtSecret?: string;
  connectorMode: "mock";
  openAiApiKey?: string;
  openAiModel?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = Env.parse(env);
  if (!e.SUPABASE_JWKS_URL && !e.SUPABASE_JWT_SECRET) {
    throw new Error(
      "Set SUPABASE_JWKS_URL (recommended) or SUPABASE_JWT_SECRET so the API can verify access tokens.",
    );
  }
  if (e.OPENAI_API_KEY && !e.OPENAI_MODEL) throw new Error("Set OPENAI_MODEL when configuring OPENAI_API_KEY for grounded policy answers.");
  return {
    port: e.API_PORT,
    corsOrigins: e.API_CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    jwksUrl: e.SUPABASE_JWKS_URL,
    jwtSecret: e.SUPABASE_JWT_SECRET,
    connectorMode: e.UPES_CONNECTOR_MODE,
    openAiApiKey: e.OPENAI_API_KEY,
    openAiModel: e.OPENAI_MODEL,
  };
}
