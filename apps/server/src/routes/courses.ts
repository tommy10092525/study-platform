import { zValidator } from "@hono/zod-validator";
import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import { courses, documents, files, questionGroups } from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

const courseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(""),
});

const app = new Hono<AppEnv>()
  .get("/", async (c) => {
    const db = createDb(c.env.DB);
    const rows = await db.select().from(courses).orderBy(desc(courses.createdAt)).all();
    return c.json(rows);
  })
  .get("/:id", async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");
    const course = await db.select().from(courses).where(eq(courses.id, id)).get();
    if (!course) return c.json({ message: "Not found" }, 404);
    const [docs, fileRows, quizzes] = await Promise.all([
      db
        .select({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt })
        .from(documents)
        .where(eq(documents.courseId, id))
        .orderBy(asc(documents.createdAt))
        .all(),
      db
        .select({
          id: files.id,
          title: files.title,
          filename: files.filename,
          format: files.format,
          size: files.size,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(eq(files.courseId, id))
        .orderBy(asc(files.createdAt))
        .all(),
      db
        .select()
        .from(questionGroups)
        .where(eq(questionGroups.courseId, id))
        .orderBy(asc(questionGroups.createdAt))
        .all(),
    ]);
    return c.json({ ...course, documents: docs, files: fileRows, quizzes });
  })
  .post("/", requireAdmin, zValidator("json", courseSchema), async (c) => {
    const db = createDb(c.env.DB);
    const [created] = await db
      .insert(courses)
      .values({ ...c.req.valid("json"), createdBy: c.get("user").id })
      .returning();
    return c.json(created!, 201);
  })
  .patch("/:id", requireAdmin, zValidator("json", courseSchema.partial()), async (c) => {
    const db = createDb(c.env.DB);
    const [updated] = await db
      .update(courses)
      .set(c.req.valid("json"))
      .where(eq(courses.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ message: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");
    // D1 の行は cascade で消えるが R2 の実体は残るので先に削除する
    const keys = await db.select({ key: files.key }).from(files).where(eq(files.courseId, id)).all();
    if (keys.length > 0) await c.env.BUCKET.delete(keys.map((k) => k.key));
    const [deleted] = await db.delete(courses).where(eq(courses.id, id)).returning();
    if (!deleted) return c.json({ message: "Not found" }, 404);
    return c.json(deleted);
  });

export default app;
