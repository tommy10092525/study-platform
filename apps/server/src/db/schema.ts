import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// 列定義はテーブルごとに新しいインスタンスを作る (同じビルダーを複数テーブルで共有しない)
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID()).notNull();
const title = () => text("title").notNull();
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);
const updatedAt = () =>
  text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** Discord アカウントと 1:1 対応するユーザー */
export const users = sqliteTable("users", {
  id: id(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  /** 管理者ロール (DISCORD_ADMIN_ROLE_IDS) を持つか。ログインのたびに Discord から同期 */
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** ログインセッション。id にはトークンの SHA-256 ハッシュを保存する */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** コース (教材・テストをまとめる単位) */
export const courses = sqliteTable("courses", {
  id: id(),
  title: title(),
  description: text("description").notNull().default(""),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Markdown 教材 */
export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    title: title(),
    markdown: text("markdown").notNull().default(""),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("documents_course_id_idx").on(t.courseId)],
);

/** アップロードされた教材ファイル (PDF / PPTX など)。実体は R2 */
export const files = sqliteTable(
  "files",
  {
    id: id(),
    title: title(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** 元のファイル名 */
    filename: text("filename").notNull(),
    /** 拡張子 (小文字, ドットなし)。ビューア選択に使う */
    format: text("format").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    /** R2 オブジェクトキー */
    key: text("key").notNull().unique(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("files_course_id_idx").on(t.courseId)],
);

/** Markdown に差し込む画像。実体は R2 */
export const images = sqliteTable("images", {
  id: id(),
  key: text("key").notNull().unique(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** テスト (一問一答の問題集) */
export const questionGroups = sqliteTable(
  "question_groups",
  {
    id: id(),
    title: title(),
    description: text("description").notNull().default(""),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("question_groups_course_id_idx").on(t.courseId)],
);

/** 問題 */
export const questions = sqliteTable(
  "questions",
  {
    id: id(),
    questionGroupId: text("question_group_id")
      .notNull()
      .references(() => questionGroups.id, { onDelete: "cascade" }),
    /** 問題文 (Markdown) */
    prompt: text("prompt").notNull(),
    /** 正解として受け付ける解答の一覧 (JSON 配列) */
    acceptedAnswers: text("accepted_answers", { mode: "json" }).$type<string[]>().notNull(),
    /** true のとき大文字・小文字を区別して採点する */
    caseSensitive: integer("case_sensitive", { mode: "boolean" }).notNull().default(false),
    /** 解説 (Markdown, 採点後に表示) */
    explanation: text("explanation").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("questions_group_id_idx").on(t.questionGroupId)],
);

/** 受験記録 (1 回のテスト提出) */
export const answers = sqliteTable(
  "answers",
  {
    id: id(),
    questionGroupId: text("question_group_id")
      .notNull()
      .references(() => questionGroups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("answers_group_id_idx").on(t.questionGroupId),
    index("answers_user_id_idx").on(t.userId),
  ],
);

/** 受験記録内の各問題への解答 */
export const eachAnswers = sqliteTable(
  "each_answers",
  {
    id: id(),
    answerId: text("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    response: text("response").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  },
  (t) => [uniqueIndex("each_answers_answer_question_idx").on(t.answerId, t.questionId)],
);
