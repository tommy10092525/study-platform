import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import { answers, courses, eachAnswers, questionGroups, questions, users } from "../db/schema";
import { isCorrect } from "../lib/grading";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

const quizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(""),
});

const questionInputSchema = z.object({
  /** 既存の問題を更新する場合に指定。省略時は新規作成 */
  id: z.string().optional(),
  prompt: z.string().trim().min(1).max(10_000),
  acceptedAnswers: z
    .array(z.string().trim().min(1).max(1000))
    .min(1, "正解を 1 つ以上登録してください")
    .max(50),
  caseSensitive: z.boolean().default(false),
  explanation: z.string().max(10_000).default(""),
});

const submitSchema = z.object({
  /** questionId -> 解答 */
  responses: z.record(z.string(), z.string().max(1000)),
});

const app = new Hono<AppEnv>()
  .post(
    "/",
    requireAdmin,
    zValidator("json", quizSchema.extend({ courseId: z.string().min(1) })),
    async (c) => {
      const db = createDb(c.env.DB);
      const input = c.req.valid("json");
      const course = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, input.courseId))
        .get();
      if (!course) return c.json({ message: "コースが見つかりません" }, 404);
      const [created] = await db.insert(questionGroups).values(input).returning();
      return c.json(created!, 201);
    },
  )
  /** 受験用: 正解・解説は含めない */
  .get("/:id", async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");
    const quiz = await db.select().from(questionGroups).where(eq(questionGroups.id, id)).get();
    if (!quiz) return c.json({ message: "Not found" }, 404);
    const rows = await db
      .select({ id: questions.id, prompt: questions.prompt, position: questions.position })
      .from(questions)
      .where(eq(questions.questionGroupId, id))
      .orderBy(asc(questions.position), asc(questions.createdAt))
      .all();
    return c.json({ ...quiz, questions: rows });
  })
  /** 編集用: 正解・解説を含む (管理者のみ) */
  .get("/:id/edit", requireAdmin, async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param("id");
    const quiz = await db.select().from(questionGroups).where(eq(questionGroups.id, id)).get();
    if (!quiz) return c.json({ message: "Not found" }, 404);
    const rows = await db
      .select()
      .from(questions)
      .where(eq(questions.questionGroupId, id))
      .orderBy(asc(questions.position), asc(questions.createdAt))
      .all();
    return c.json({ ...quiz, questions: rows });
  })
  .patch("/:id", requireAdmin, zValidator("json", quizSchema.partial()), async (c) => {
    const db = createDb(c.env.DB);
    const [updated] = await db
      .update(questionGroups)
      .set(c.req.valid("json"))
      .where(eq(questionGroups.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ message: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const db = createDb(c.env.DB);
    const [deleted] = await db
      .delete(questionGroups)
      .where(eq(questionGroups.id, c.req.param("id")))
      .returning();
    if (!deleted) return c.json({ message: "Not found" }, 404);
    return c.json(deleted);
  })
  /**
   * 問題一覧を丸ごと保存する。
   * id 付きの問題は更新、id なしは追加、リストから消えた問題は削除 (その問題の解答履歴も消える)。
   */
  .put(
    "/:id/questions",
    requireAdmin,
    zValidator("json", z.object({ questions: z.array(questionInputSchema).max(500) })),
    async (c) => {
      const db = createDb(c.env.DB);
      const groupId = c.req.param("id");
      const quiz = await db
        .select({ id: questionGroups.id })
        .from(questionGroups)
        .where(eq(questionGroups.id, groupId))
        .get();
      if (!quiz) return c.json({ message: "Not found" }, 404);

      const existingIds = new Set(
        (
          await db
            .select({ id: questions.id })
            .from(questions)
            .where(eq(questions.questionGroupId, groupId))
            .all()
        ).map((r) => r.id),
      );
      const input = c.req.valid("json").questions;
      const keepIds = new Set(input.flatMap((q) => (q.id && existingIds.has(q.id) ? [q.id] : [])));
      const removeIds = [...existingIds].filter((id) => !keepIds.has(id));

      const ops: BatchItem<"sqlite">[] = [];
      if (removeIds.length > 0) {
        ops.push(db.delete(questions).where(inArray(questions.id, removeIds)));
      }
      input.forEach((q, position) => {
        const values = {
          prompt: q.prompt,
          acceptedAnswers: q.acceptedAnswers,
          caseSensitive: q.caseSensitive,
          explanation: q.explanation,
          position,
        };
        if (q.id && keepIds.has(q.id)) {
          ops.push(
            db
              .update(questions)
              .set(values)
              .where(and(eq(questions.id, q.id), eq(questions.questionGroupId, groupId))),
          );
        } else {
          ops.push(db.insert(questions).values({ ...values, questionGroupId: groupId }));
        }
      });
      const [first, ...rest] = ops;
      if (first) await db.batch([first, ...rest]);

      const rows = await db
        .select()
        .from(questions)
        .where(eq(questions.questionGroupId, groupId))
        .orderBy(asc(questions.position))
        .all();
      return c.json({ questions: rows });
    },
  )
  /** 解答を提出して採点する */
  .post("/:id/submit", zValidator("json", submitSchema), async (c) => {
    const db = createDb(c.env.DB);
    const groupId = c.req.param("id");
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.questionGroupId, groupId))
      .orderBy(asc(questions.position))
      .all();
    if (qs.length === 0) return c.json({ message: "問題がありません" }, 400);

    const { responses } = c.req.valid("json");
    const graded = qs.map((q) => {
      const response = responses[q.id] ?? "";
      return { questionId: q.id, response, isCorrect: isCorrect(response, q.acceptedAnswers, q.caseSensitive) };
    });
    const score = graded.filter((g) => g.isCorrect).length;

    const attemptId = crypto.randomUUID();
    await db.batch([
      db.insert(answers).values({
        id: attemptId,
        questionGroupId: groupId,
        userId: c.get("user").id,
        score,
        total: qs.length,
      }),
      db.insert(eachAnswers).values(graded.map((g) => ({ ...g, answerId: attemptId }))),
    ]);
    return c.json({ attemptId, score, total: qs.length }, 201);
  })
  /** 受験履歴。通常は自分の分のみ、管理者は ?all=1 で全員分 */
  .get(
    "/:id/attempts",
    zValidator("query", z.object({ all: z.literal("1").optional() })),
    async (c) => {
    const db = createDb(c.env.DB);
    const user = c.get("user");
    const all = c.req.valid("query").all === "1" && user.isAdmin;
    const rows = await db
      .select({
        id: answers.id,
        score: answers.score,
        total: answers.total,
        createdAt: answers.createdAt,
        userId: users.id,
        displayName: users.displayName,
      })
      .from(answers)
      .innerJoin(users, eq(users.id, answers.userId))
      .where(
        all
          ? eq(answers.questionGroupId, c.req.param("id"))
          : and(eq(answers.questionGroupId, c.req.param("id")), eq(answers.userId, user.id)),
      )
      .orderBy(desc(answers.createdAt))
      .limit(500)
      .all();
    return c.json(rows);
    },
  );

export default app;
