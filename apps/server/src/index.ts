import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requireAuth } from "./middleware/auth";
import attempts from "./routes/attempts";
import auth from "./routes/auth";
import courses from "./routes/courses";
import documents from "./routes/documents";
import files from "./routes/files";
import images from "./routes/images";
import quizzes from "./routes/quizzes";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
  }),
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// /api/auth 以外はすべてログイン必須 (= サークルの Discord メンバーのみ)
for (const path of ["courses", "documents", "files", "images", "quizzes", "attempts"]) {
  app.use(`/api/${path}/*`, requireAuth);
  app.use(`/api/${path}`, requireAuth);
}

const routes = app
  .route("/api/auth", auth)
  .route("/api/courses", courses)
  .route("/api/documents", documents)
  .route("/api/files", files)
  .route("/api/images", images)
  .route("/api/quizzes", quizzes)
  .route("/api/attempts", attempts);

app.onError((err, c) => {
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});

export default app;
export type AppType = typeof routes;
