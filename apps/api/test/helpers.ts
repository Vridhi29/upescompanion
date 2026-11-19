import { SignJWT } from "jose";
import { buildApp } from "../src/app";
import { InMemoryRepository } from "../src/repositories/memory";
import type { TokenVerifier } from "../src/plugins/auth";

export const USER_A = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com" };
export const USER_B = { id: "22222222-2222-4222-8222-222222222222", email: "b@example.com" };

export const fakeVerify: TokenVerifier = async (token) => {
  if (token === "token-a") return USER_A;
  if (token === "token-b") return USER_B;
  throw new Error("bad token");
};

export async function makeApp(overrides: Parameters<typeof buildApp>[0] extends infer T ? Partial<T> : never = {}) {
  const repo = new InMemoryRepository();
  const app = await buildApp({ repo, verify: fakeVerify, retry: { sleep: async () => {} }, ...overrides });
  return { app, repo };
}

export async function signToken(secret: string, sub: string, opts: { exp?: string; aud?: string } = {}) {
  return new SignJWT({ email: "x@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience(opts.aud ?? "authenticated")
    .setExpirationTime(opts.exp ?? "1h")
    .sign(new TextEncoder().encode(secret));
}

export const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
