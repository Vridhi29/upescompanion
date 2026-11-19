import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config";

export interface AuthUser {
  id: string;
  email: string;
}

export type TokenVerifier = (token: string) => Promise<AuthUser>;

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** Verifies Supabase access tokens (JWKS for asymmetric keys, or the legacy HS256 secret). */
export function createSupabaseVerifier(config: Pick<AppConfig, "jwksUrl" | "jwtSecret">): TokenVerifier {
  const jwks = config.jwksUrl ? createRemoteJWKSet(new URL(config.jwksUrl)) : null;
  const secret = config.jwtSecret ? new TextEncoder().encode(config.jwtSecret) : null;
  if (!jwks && !secret) throw new Error("No JWT verification key configured.");

  return async (token) => {
    const { payload } = jwks
      ? await jwtVerify(token, jwks, { audience: "authenticated" })
      : await jwtVerify(token, secret!, { audience: "authenticated", algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("Token has no subject.");
    const email = typeof payload.email === "string" ? payload.email : "";
    return { id: payload.sub, email };
  };
}

export function requireAuth(verify: TokenVerifier) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "unauthenticated", message: "Sign in to continue." });
    }
    try {
      req.user = await verify(header.slice(7));
    } catch {
      return reply.code(401).send({ error: "invalid_token", message: "Your session has expired. Sign in again." });
    }
  };
}
