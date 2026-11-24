import type { AppType } from "server";
import { hc } from "hono/client";

// Dev: relative path, proxied by Vite (see vite.config.ts) to `wrangler dev`.
// Prod: set VITE_API_URL if the API is deployed on a different origin than
// the frontend (the server's CORS config in apps/server/src/index.ts already
// allows cross-origin requests).
const baseUrl = import.meta.env.VITE_API_URL ?? "/";

export const client = hc<AppType>(baseUrl, {
  // セッション Cookie を送る (別オリジン構成でも動くように)
  init: { credentials: "include" },
});

/** API の絶対/相対 URL を組み立てる (<img src> や <iframe src> 用) */
export function apiUrl(path: string) {
  return new URL(path, new URL(baseUrl, window.location.origin)).toString();
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type AnyResponse = {
  ok: boolean;
  status: number;
  clone(): { json(): Promise<unknown> };
};

/**
 * 失敗レスポンスなら ApiError を投げ、成功レスポンス (型も 2xx 側に絞り込んだもの) を返す。
 * 例: `const res = await ensureOk(await client.api.courses.$get()); return res.json();`
 */
export async function ensureOk<R extends AnyResponse>(res: R): Promise<Exclude<R, { ok: false }>> {
  if (res.ok) return res as Exclude<R, { ok: false }>;
  let message = `エラーが発生しました (${res.status})`;
  try {
    const body = (await res.clone().json()) as {
      message?: string;
      error?: { issues?: { message: string }[] };
    };
    message = body.message ?? body.error?.issues?.[0]?.message ?? message;
  } catch {
    // JSON でないレスポンス
  }
  throw new ApiError(message, res.status);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value: string) {
  // D1 の current_timestamp は UTC の "YYYY-MM-DD HH:MM:SS"
  const d = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ja-JP");
}
