import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { users } from "./db/schema";

export type Bindings = {
  DB: D1Database;
  /** 教材ファイル・Markdown 用画像の保存先 */
  BUCKET: R2Bucket;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  /** サークルの Discord サーバー (guild) ID。メンバーのみログインを許可する */
  DISCORD_GUILD_ID: string;
  /** 管理者 (教材・テストの編集者) とみなすロール ID。カンマ区切り */
  DISCORD_ADMIN_ROLE_IDS?: string;
  /**
   * OAuth のリダイレクト先を組み立てる基準 URL (例: http://localhost:5173)。
   * 未設定ならリクエストのオリジンを使う。
   */
  APP_URL?: string;
  /** "true" のとき localhost からの開発用ログイン (/api/auth/dev-login) を有効化 */
  DEV_AUTH_BYPASS?: string;
};

export type User = typeof users.$inferSelect;

export type Variables = {
  user: User;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
