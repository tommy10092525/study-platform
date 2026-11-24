import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { createDb, type Database } from "../db";
import { users } from "../db/schema";
import {
  createSession,
  destroySession,
  getSessionUser,
  isSecureRequest,
  randomToken,
} from "../lib/session";
import type { AppEnv, Bindings } from "../types";

const DISCORD_API = "https://discord.com/api/v10";
const STATE_COOKIE = "oauth_state";
const NEXT_COOKIE = "oauth_next";

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

type DiscordGuildMember = {
  nick?: string | null;
  roles: string[];
};

function redirectUri(env: Bindings, requestUrl: string) {
  const base = env.APP_URL ?? new URL(requestUrl).origin;
  return new URL("/api/auth/callback", base).toString();
}

function appUrl(env: Bindings, requestUrl: string, path: string) {
  return new URL(path, env.APP_URL ?? new URL(requestUrl).origin).toString();
}

/** オープンリダイレクトを防ぐため、同一オリジン内の相対パスのみ許可 */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

function adminRoleIds(env: Bindings) {
  return (env.DISCORD_ADMIN_ROLE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function upsertUser(
  db: Database,
  values: { discordId: string; username: string; displayName: string; avatar: string | null; isAdmin: boolean },
) {
  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.discordId,
      set: {
        username: values.username,
        displayName: values.displayName,
        avatar: values.avatar,
        isAdmin: values.isAdmin,
        updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    })
    .returning();
  if (!user) throw new Error("Failed to upsert user");
  return user;
}

function isLocalhost(url: string) {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

const app = new Hono<AppEnv>()
  .get("/me", async (c) => {
    const user = await getSessionUser(c, createDb(c.env.DB));
    return c.json({
      user: user
        ? {
            id: user.id,
            discordId: user.discordId,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            isAdmin: user.isAdmin,
          }
        : null,
      devLoginEnabled: c.env.DEV_AUTH_BYPASS === "true" && isLocalhost(c.req.url),
    });
  })
  .get("/login", (c) => {
    const missing = (["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID"] as const).filter(
      (k) => !c.env[k],
    );
    if (missing.length > 0) {
      // .dev.vars を編集した後は wrangler dev の再起動が必要 (変更は自動では読み込まれない)
      console.error(`Missing environment variables: ${missing.join(", ")}`);
      return c.text(
        `サーバーの設定が不足しています: ${missing.join(", ")}\n` +
          "ローカルでは apps/server/.dev.vars に設定し、wrangler dev (pnpm dev) を再起動してください。",
        500,
      );
    }
    const state = randomToken(16);
    const cookieOpts = {
      httpOnly: true,
      secure: isSecureRequest(c),
      sameSite: "Lax" as const,
      path: "/api/auth",
      maxAge: 600,
    };
    setCookie(c, STATE_COOKIE, state, cookieOpts);
    setCookie(c, NEXT_COOKIE, safeNext(c.req.query("next")), cookieOpts);

    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", c.env.DISCORD_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri(c.env, c.req.url));
    // identify: ユーザー情報 / guilds.members.read: サーバー所属とロールの確認
    url.searchParams.set("scope", "identify guilds.members.read");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "none");
    return c.redirect(url.toString());
  })
  .get("/callback", async (c) => {
    const fail = (reason: string) =>
      c.redirect(appUrl(c.env, c.req.url, `/login?error=${encodeURIComponent(reason)}`));

    const expectedState = getCookie(c, STATE_COOKIE);
    const next = safeNext(getCookie(c, NEXT_COOKIE));
    deleteCookie(c, STATE_COOKIE, { path: "/api/auth" });
    deleteCookie(c, NEXT_COOKIE, { path: "/api/auth" });

    const { code, state, error } = c.req.query();
    if (error) return fail("denied");
    if (!code || !state || !expectedState || state !== expectedState) return fail("invalid_state");

    // 1. 認可コードをアクセストークンに交換
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${c.env.DISCORD_CLIENT_ID}:${c.env.DISCORD_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(c.env, c.req.url),
      }),
    });
    if (!tokenRes.ok) {
      console.error("Discord token exchange failed", tokenRes.status, await tokenRes.text());
      return fail("token");
    }
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const authHeader = { Authorization: `Bearer ${access_token}` };

    // 2. ユーザー情報とサークルサーバーでのメンバー情報を取得
    const [meRes, memberRes] = await Promise.all([
      fetch(`${DISCORD_API}/users/@me`, { headers: authHeader }),
      fetch(`${DISCORD_API}/users/@me/guilds/${c.env.DISCORD_GUILD_ID}/member`, {
        headers: authHeader,
      }),
    ]);
    if (!meRes.ok) return fail("user");
    if (!memberRes.ok) {
      // 404 = サーバーに参加していない
      return fail(memberRes.status === 404 ? "not_member" : "member");
    }
    const me = (await meRes.json()) as DiscordUser;
    const member = (await memberRes.json()) as DiscordGuildMember;

    const adminRoles = adminRoleIds(c.env);
    const db = createDb(c.env.DB);
    const user = await upsertUser(db, {
      discordId: me.id,
      username: me.username,
      displayName: member.nick ?? me.global_name ?? me.username,
      avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png` : null,
      isAdmin: member.roles.some((r) => adminRoles.includes(r)),
    });

    await createSession(c, db, user.id);
    return c.redirect(appUrl(c.env, c.req.url, next));
  })
  .post("/logout", async (c) => {
    await destroySession(c, createDb(c.env.DB));
    return c.json({ ok: true });
  })
  // 開発用ログイン。DEV_AUTH_BYPASS=true かつ localhost からのアクセスのみ有効
  .post(
    "/dev-login",
    zValidator("json", z.object({ name: z.string().min(1).max(32), isAdmin: z.boolean() })),
    async (c) => {
      if (c.env.DEV_AUTH_BYPASS !== "true" || !isLocalhost(c.req.url)) {
        return c.json({ message: "Not found" }, 404);
      }
      const { name, isAdmin } = c.req.valid("json");
      const db = createDb(c.env.DB);
      const user = await upsertUser(db, {
        discordId: `dev:${name}`,
        username: name,
        displayName: name,
        avatar: null,
        isAdmin,
      });
      await createSession(c, db, user.id);
      return c.json({ ok: true });
    },
  );

export default app;
