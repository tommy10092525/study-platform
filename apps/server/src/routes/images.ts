import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import { images } from "../db/schema";
import { IMAGE_EXTS, contentTypeFor, extensionOf, serveObject } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const app = new Hono<AppEnv>()
  .get("/:id", async (c) => {
    const db = createDb(c.env.DB);
    const row = await db.select().from(images).where(eq(images.id, c.req.param("id"))).get();
    if (!row) return c.json({ message: "Not found" }, 404);
    return serveObject(c.env.BUCKET, row.key, c.req.raw, {
      contentType: row.contentType,
      immutable: true,
    });
  })
  .post("/", requireAdmin, zValidator("form", z.object({ file: z.instanceof(File) })), async (c) => {
    const { file } = c.req.valid("form");
    // SVG はスクリプトを含められるため受け付けない
    const ext = extensionOf(file.name) || file.type.replace("image/", "");
    if (!(IMAGE_EXTS as readonly string[]).includes(ext)) {
      return c.json({ message: "PNG / JPEG / GIF / WebP のみアップロードできます" }, 400);
    }
    if (file.size > MAX_IMAGE_SIZE) return c.json({ message: "画像は 10MB までです" }, 413);

    const contentType = contentTypeFor(ext);
    const id = crypto.randomUUID();
    const key = `images/${id}.${ext}`;
    await c.env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType } });
    await createDb(c.env.DB)
      .insert(images)
      .values({ id, key, contentType, size: file.size, uploadedBy: c.get("user").id });
    return c.json({ id, url: `/api/images/${id}` }, 201);
  });

export default app;
