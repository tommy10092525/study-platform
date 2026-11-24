import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, ErrorText, Loading } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AttemptResult() {
  const { attemptId = "" } = useParams();
  const { user } = useAuth();
  const attemptQuery = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: async () =>
      (await ensureOk(await client.api.attempts[":id"].$get({ param: { id: attemptId } }))).json(),
  });

  if (attemptQuery.isLoading) return <Loading />;
  if (attemptQuery.error || !attemptQuery.data) return <ErrorText error={attemptQuery.error} />;
  const a = attemptQuery.data;
  const percent = Math.round((a.score / a.total) * 100);

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/quizzes/${a.quizId}`} className="text-sm text-muted-foreground hover:underline">
        ← テストに戻る
      </Link>
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {a.quizTitle}
          {a.userId !== user?.id && ` · ${a.displayName}`} · {formatDate(a.createdAt)}
        </p>
        <p className="text-4xl font-bold">
          {a.score} <span className="text-xl text-muted-foreground">/ {a.total}</span>
        </p>
        <p className="text-sm text-muted-foreground">正答率 {percent}%</p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to={`/quizzes/${a.quizId}`}>
            <RotateCcw />
            もう一度解く
          </Link>
        </Button>
      </Card>

      <ol className="flex flex-col gap-4">
        {a.items.map((item, i) => (
          <li key={item.questionId}>
            <Card
              className={cn(
                "flex flex-col gap-3 border-l-4 p-4",
                item.isCorrect ? "border-l-green-600" : "border-l-destructive",
              )}
            >
              <div className="flex gap-3">
                {item.isCorrect ? (
                  <CheckCircle2 className="size-5 shrink-0 text-green-600" aria-label="正解" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-destructive" aria-label="不正解" />
                )}
                <span className="font-semibold text-muted-foreground">Q{i + 1}.</span>
                <Markdown className="min-w-0 flex-1">{item.prompt}</Markdown>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">あなたの解答</dt>
                <dd className={cn("font-mono", !item.response && "text-muted-foreground")}>
                  {item.response || "(未回答)"}
                </dd>
                <dt className="text-muted-foreground">正解</dt>
                <dd className="font-mono">{item.acceptedAnswers.join(" / ")}</dd>
              </dl>
              {item.explanation && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">解説</p>
                  <Markdown className="text-sm">{item.explanation}</Markdown>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
