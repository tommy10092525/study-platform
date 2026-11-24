import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, ErrorText, Loading } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

function AttemptHistory({ quizId }: { quizId: string }) {
  const { isAdmin } = useAuth();
  const [all, setAll] = useState(false);
  const attemptsQuery = useQuery({
    queryKey: ["attempts", quizId, all],
    queryFn: async () =>
      (
        await ensureOk(
          await client.api.quizzes[":id"].attempts.$get({
            param: { id: quizId },
            query: all ? { all: "1" } : {},
          }),
        )
      ).json(),
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{all ? "全員の受験履歴" : "あなたの受験履歴"}</h2>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? "自分の履歴を表示" : "全員の履歴を表示"}
          </Button>
        )}
      </div>
      {attemptsQuery.isLoading && <Loading />}
      <ErrorText error={attemptsQuery.error} />
      {attemptsQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">まだ受験していません。</p>
      )}
      <ul className="flex flex-col gap-2">
        {attemptsQuery.data?.map((a) => (
          <li key={a.id}>
            <Link
              to={`/attempts/${a.id}`}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent/50"
            >
              <span className="text-muted-foreground">
                {formatDate(a.createdAt)}
                {all && <span className="ml-2 text-foreground">{a.displayName}</span>}
              </span>
              <span className="font-medium">
                {a.score} / {a.total}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({Math.round((a.score / a.total) * 100)}%)
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function QuizTake() {
  const { quizId = "" } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});

  const quizQuery = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () =>
      (await ensureOk(await client.api.quizzes[":id"].$get({ param: { id: quizId } }))).json(),
  });

  const submit = useMutation({
    mutationFn: async () =>
      (
        await ensureOk(
          await client.api.quizzes[":id"].submit.$post({ param: { id: quizId }, json: { responses } }),
        )
      ).json(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["attempts", quizId] });
      navigate(`/attempts/${result.attemptId}`);
    },
  });

  if (quizQuery.isLoading) return <Loading />;
  if (quizQuery.error || !quizQuery.data) return <ErrorText error={quizQuery.error} />;
  const quiz = quizQuery.data;
  const answered = quiz.questions.filter((q) => (responses[q.id] ?? "").trim() !== "").length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link to={`/courses/${quiz.courseId}`} className="text-sm text-muted-foreground hover:underline">
          ← コースに戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{quiz.title}</h1>
            <p className="text-sm text-muted-foreground">全 {quiz.questions.length} 問</p>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/quizzes/${quiz.id}/edit`}>
                <Pencil />
                編集
              </Link>
            </Button>
          )}
        </div>
        {quiz.description && <Markdown className="text-sm">{quiz.description}</Markdown>}
      </div>

      {quiz.questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">問題はまだ登録されていません。</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              answered < quiz.questions.length &&
              !window.confirm(`未回答の問題が ${quiz.questions.length - answered} 問あります。提出しますか？`)
            ) {
              return;
            }
            submit.mutate();
          }}
        >
          {quiz.questions.map((q, i) => (
            <Card key={q.id} className="flex flex-col gap-3 p-4">
              <div className="flex gap-3">
                <span className="font-semibold text-muted-foreground">Q{i + 1}.</span>
                <Markdown className="min-w-0 flex-1">{q.prompt}</Markdown>
              </div>
              <Input
                value={responses[q.id] ?? ""}
                onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                placeholder="解答を入力"
                autoComplete="off"
                spellCheck={false}
              />
            </Card>
          ))}
          <ErrorText error={submit.error} />
          <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border bg-background/90 p-3 backdrop-blur">
            <span className={cn("text-sm text-muted-foreground")}>
              回答済み {answered} / {quiz.questions.length}
            </span>
            <Button type="submit" disabled={submit.isPending}>
              提出して採点
            </Button>
          </div>
        </form>
      )}

      <AttemptHistory quizId={quiz.id} />
    </div>
  );
}
