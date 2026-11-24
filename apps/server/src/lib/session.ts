import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Database } from "../db";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 日

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function isSecureRequest(c: Context) {
  return new URL(c.req.url).protocol === "https:";
}

export async function createSession(c: Context, db: Database, userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: await sha256Hex(token), userId, expiresAt });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(c: Context, db: Database) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = await db
    .select({ user: users, expiresAt: sessions.expiresAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, await sha256Hex(token)))
    .get();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }
  return row.user;
}

export async function destroySession(c: Context, db: Database) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export { randomToken };
