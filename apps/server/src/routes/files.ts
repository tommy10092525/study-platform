import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import { courses, files } from "../db/schema";
import { contentTypeFor, extensionOf, serveObject } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

/** Workers のリクエストボディ上限 (100MB) とメモリ上限 (128MB) を考慮した上限 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

const uploadSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  file: z.instanceof(File),
});

function withoutKey<T extends { key: string }>(row: T): Omit<T, "key"> {
  const { key: _key, ...meta } = row;
  return meta;
}

const app = new Hono<AppEnv>()
  .get("/:id", async (c) => {
    const db = createDb(c.env.DB);
    const row = await db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
    if (!row) return c.json({ message: "Not found" }, 404);
    return c.json(withoutKey(row));
  })
  .get("/:id/content", async (c) => {
    const db = createDb(c.env.DB);
    const row = await db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
    if (!row) return c.json({ message: "Not found" }, 404);
    return serveObject(c.env.BUCKET, row.key, c.req.raw, {
      contentType: row.contentType,
      filename: row.filename,
      download: c.req.query("download") === "1",
    });
  })
  .post("/", requireAdmin, zValidator("form", uploadSchema), async (c) => {
    const { courseId, title, file } = c.req.valid("form");
    if (file.size === 0) return c.json({ message: "空のファイルです" }, 400);
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ message: `ファイルサイズは ${MAX_FILE_SIZE / 1024 / 1024}MB までです` }, 413);
    }
    const db = createDb(c.env.DB);
    const course = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();
    if (!course) return c.json({ message: "コースが見つかりません" }, 404);

    const format = extensionOf(file.name);
    const contentType = contentTypeFor(format);
    const key = `files/${courseId}/${crypto.randomUUID()}${format ? `.${format}` : ""}`;
    await c.env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType } });

    try {
      const [created] = await db
        .insert(files)
        .values({
          courseId,
          title: title || file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          format,
          contentType,
          size: file.size,
          key,
          createdBy: c.get("user").id,
        })
        .returning();
      return c.json(withoutKey(created!), 201);
    } catch (e) {
      await c.env.BUCKET.delete(key);
      throw e;
    }
  })
  .patch(
    "/:id",
    requireAdmin,
    zValidator("json", z.object({ title: z.string().trim().min(1).max(200) })),
    async (c) => {
      const db = createDb(c.env.DB);
      const [updated] = await db
        .update(files)
        .set(c.req.valid("json"))
        .where(eq(files.id, c.req.param("id")))
        .returning();
      if (!updated) return c.json({ message: "Not found" }, 404);
      return c.json(withoutKey(updated));
    },
  )
  .delete("/:id", requireAdmin, async (c) => {
    const db = createDb(c.env.DB);
    const [deleted] = await db.delete(files).where(eq(files.id, c.req.param("id"))).returning();
    if (!deleted) return c.json({ message: "Not found" }, 404);
    await c.env.BUCKET.delete(deleted.key);
    return c.json({ id: deleted.id });
  });

export default app;
