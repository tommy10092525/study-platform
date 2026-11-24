import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db";
import { answers, eachAnswers, questionGroups, questions, users } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>()
  /** 採点結果の詳細 (本人または管理者のみ)。正解と解説を含む */
  .get("/:id", async (c) => {
    const db = createDb(c.env.DB);
    const user = c.get("user");
    const attempt = await db
      .select({
        id: answers.id,
        score: answers.score,
        total: answers.total,
        createdAt: answers.createdAt,
        userId: answers.userId,
        displayName: users.displayName,
        quizId: questionGroups.id,
        quizTitle: questionGroups.title,
        courseId: questionGroups.courseId,
      })
      .from(answers)
      .innerJoin(users, eq(users.id, answers.userId))
      .innerJoin(questionGroups, eq(questionGroups.id, answers.questionGroupId))
      .where(eq(answers.id, c.req.param("id")))
      .get();
    if (!attempt || (attempt.userId !== user.id && !user.isAdmin)) {
      return c.json({ message: "Not found" }, 404);
    }
    const items = await db
      .select({
        questionId: questions.id,
        prompt: questions.prompt,
        acceptedAnswers: questions.acceptedAnswers,
        explanation: questions.explanation,
        response: eachAnswers.response,
        isCorrect: eachAnswers.isCorrect,
      })
      .from(eachAnswers)
      .innerJoin(questions, eq(questions.id, eachAnswers.questionId))
      .where(eq(eachAnswers.answerId, attempt.id))
      .orderBy(asc(questions.position))
      .all();
    return c.json({ ...attempt, items });
  });

export default app;
