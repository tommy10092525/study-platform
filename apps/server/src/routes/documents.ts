import { zValidator } from "@hono/zod-validator";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import { documents } from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

const createSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  markdown: z.string().max(500_000).default(""),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  markdown: z.string().max(500_000).optional(),
});

const app = new Hono<AppEnv>()
  .get("/:id", async (c) => {
    const db = createDb(c.env.DB);
    const doc = await db.select().from(documents).where(eq(documents.id, c.req.param("id"))).get();
    if (!doc) return c.json({ message: "Not found" }, 404);
    return c.json(doc);
  })
  .post("/", requireAdmin, zValidator("json", createSchema), async (c) => {
    const db = createDb(c.env.DB);
    const [created] = await db
      .insert(documents)
      .values({ ...c.req.valid("json"), createdBy: c.get("user").id })
      .returning();
    return c.json(created!, 201);
  })
  .patch("/:id", requireAdmin, zValidator("json", updateSchema), async (c) => {
    const db = createDb(c.env.DB);
    const [updated] = await db
      .update(documents)
      .set({ ...c.req.valid("json"), updatedAt: sql`(current_timestamp)` })
      .where(eq(documents.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ message: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const db = createDb(c.env.DB);
    const [deleted] = await db
      .delete(documents)
      .where(eq(documents.id, c.req.param("id")))
      .returning();
    if (!deleted) return c.json({ message: "Not found" }, 404);
    return c.json(deleted);
  });

export default app;
