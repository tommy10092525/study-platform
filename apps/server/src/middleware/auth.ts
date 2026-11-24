import { createMiddleware } from "hono/factory";
import { createDb } from "../db";
import { getSessionUser } from "../lib/session";
import type { AppEnv } from "../types";

/** ログイン済みユーザーのみ通す */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = await getSessionUser(c, createDb(c.env.DB));
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
});

/** 管理者のみ通す (requireAuth の後に使う) */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user").isAdmin) return c.json({ message: "Forbidden" }, 403);
  await next();
});
