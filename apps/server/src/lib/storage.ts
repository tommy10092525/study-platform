import type { R2Bucket, R2Range } from "@cloudflare/workers-types";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

export const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

/** ブラウザでインライン表示しても安全な Content-Type (HTML/SVG などはダウンロード扱い) */
const INLINE_SAFE = /^(application\/pdf|image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|audio\/mpeg|text\/(plain|markdown|csv)(;.*)?)$/;

export function extensionOf(filename: string) {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  return m?.[1]?.toLowerCase() ?? "";
}

/** クライアント申告の MIME は信用せず、拡張子から決定する */
export function contentTypeFor(ext: string) {
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function contentRange(range: R2Range, size: number) {
  // R2 は {offset, length} / {suffix} のいずれかを返すが、未使用のキーが undefined で入っていることがある
  const r = range as { offset?: number; length?: number; suffix?: number };
  let start: number;
  let end: number;
  if (r.suffix !== undefined) {
    start = Math.max(size - r.suffix, 0);
    end = size - 1;
  } else {
    start = r.offset ?? 0;
    end = r.length !== undefined ? start + r.length - 1 : size - 1;
  }
  return `bytes ${start}-${Math.min(end, size - 1)}/${size}`;
}

/** R2 オブジェクトを (Range 対応で) レスポンスとして返す */
export async function serveObject(
  bucket: R2Bucket,
  key: string,
  req: Request,
  opts: { contentType: string; filename?: string; download?: boolean; immutable?: boolean },
) {
  const hasRange = req.headers.has("range");
  // biome-ignore lint: workers-types と DOM の Headers 型差異を吸収
  const object = await bucket.get(key, hasRange ? { range: req.headers as any } : undefined);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", opts.contentType);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  headers.set(
    "Cache-Control",
    opts.immutable ? "private, max-age=31536000, immutable" : "private, max-age=300",
  );
  const inline = !opts.download && INLINE_SAFE.test(opts.contentType);
  const name = encodeURIComponent(opts.filename ?? key.split("/").pop() ?? "file");
  headers.set(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
  );

  const body = "body" in object ? object.body : null;
  if (hasRange && object.range) {
    headers.set("Content-Range", contentRange(object.range, object.size));
    return new Response(body as unknown as BodyInit, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(body as unknown as BodyInit, { headers });
}
