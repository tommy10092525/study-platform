import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, ErrorText, Label, Loading, Textarea } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk } from "@/lib/api";

type Draft = {
  key: string;
  id?: string;
  prompt: string;
  /** 1 行に 1 つの正解 */
  answersText: string;
  caseSensitive: boolean;
  explanation: string;
};

const newDraft = (): Draft => ({
  key: crypto.randomUUID(),
  prompt: "",
  answersText: "",
  caseSensitive: false,
  explanation: "",
});

const splitAnswers = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function QuizEdit() {
  const { quizId = "" } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const quizQuery = useQuery({
    queryKey: ["quiz-edit", quizId],
    queryFn: async () =>
      (await ensureOk(await client.api.quizzes[":id"].edit.$get({ param: { id: quizId } }))).json(),
    enabled: isAdmin,
  });

  useEffect(() => {
    const quiz = quizQuery.data;
    if (!quiz || loaded) return;
    setTitle(quiz.title);
    setDescription(quiz.description);
    setDrafts(
      quiz.questions.length > 0
        ? quiz.questions.map((q) => ({
            key: q.id,
            id: q.id,
            prompt: q.prompt,
            answersText: q.acceptedAnswers.join("\n"),
            caseSensitive: q.caseSensitive,
            explanation: q.explanation,
          }))
        : [newDraft()],
    );
    setLoaded(true);
  }, [quizQuery.data, loaded]);

  const save = useMutation({
    mutationFn: async () => {
      await ensureOk(
        await client.api.quizzes[":id"].$patch({ param: { id: quizId }, json: { title, description } }),
      );
      return (
        await ensureOk(
          await client.api.quizzes[":id"].questions.$put({
            param: { id: quizId },
            json: {
              questions: drafts.map((d) => ({
                id: d.id,
                prompt: d.prompt,
                acceptedAnswers: splitAnswers(d.answersText),
                caseSensitive: d.caseSensitive,
                explanation: d.explanation,
              })),
            },
          }),
        )
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      queryClient.invalidateQueries({ queryKey: ["quiz-edit", quizId] });
      if (quizQuery.data) queryClient.invalidateQueries({ queryKey: ["course", quizQuery.data.courseId] });
      navigate(`/quizzes/${quizId}`);
    },
  });

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (index: number, delta: number) =>
    setDrafts((ds) => {
      const next = [...ds];
      const target = index + delta;
      if (target < 0 || target >= next.length) return ds;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const onSave = () => {
    if (!title.trim()) return setValidationError("タイトルを入力してください");
    const bad = drafts.findIndex((d) => !d.prompt.trim() || splitAnswers(d.answersText).length === 0);
    if (bad >= 0) return setValidationError(`Q${bad + 1}: 問題文と正解を入力してください`);
    const removed = (quizQuery.data?.questions.length ?? 0) - drafts.filter((d) => d.id).length;
    if (removed > 0 && !window.confirm(`${removed} 問を削除します。削除した問題の解答履歴も消えます。よろしいですか？`)) {
      return;
    }
    setValidationError(null);
    save.mutate();
  };

  if (!isAdmin) return <Navigate to={`/quizzes/${quizId}`} replace />;
  if (quizQuery.isLoading || !loaded) {
    return quizQuery.error ? <ErrorText error={quizQuery.error} /> : <Loading />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/quizzes/${quizId}`} className="text-sm text-muted-foreground hover:underline">
        ← テストに戻る
      </Link>
      <div className="flex flex-col gap-3">
        <Label htmlFor="quiz-title">タイトル</Label>
        <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Label htmlFor="quiz-desc">説明 (Markdown, 任意)</Label>
        <Textarea id="quiz-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex flex-col gap-4">
        {drafts.map((d, i) => (
          <Card key={d.key} className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Q{i + 1}</span>
              <div className="flex">
                <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} title="上へ">
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(i, 1)}
                  disabled={i === drafts.length - 1}
                  title="下へ"
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                  title="削除"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <Label htmlFor={`${d.key}-prompt`}>問題文 (Markdown)</Label>
            <Textarea
              id={`${d.key}-prompt`}
              value={d.prompt}
              onChange={(e) => update(d.key, { prompt: e.target.value })}
              placeholder="例: Python で標準出力に文字列を表示する関数は？"
            />
            <Label htmlFor={`${d.key}-answers`}>正解 (1 行に 1 つ。いずれかに一致すれば正解)</Label>
            <Textarea
              id={`${d.key}-answers`}
              value={d.answersText}
              onChange={(e) => update(d.key, { answersText: e.target.value })}
              placeholder={"print\nprint()"}
              className="min-h-16 font-mono"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.caseSensitive}
                onChange={(e) => update(d.key, { caseSensitive: e.target.checked })}
              />
              大文字・小文字を区別する
              <span className="text-xs text-muted-foreground">
                (前後の空白・全角半角の違いは常に無視されます)
              </span>
            </label>
            <Label htmlFor={`${d.key}-exp`}>解説 (Markdown, 任意・採点後に表示)</Label>
            <Textarea
              id={`${d.key}-exp`}
              value={d.explanation}
              onChange={(e) => update(d.key, { explanation: e.target.value })}
            />
          </Card>
        ))}
        <Button variant="outline" onClick={() => setDrafts((ds) => [...ds, newDraft()])}>
          <Plus />
          問題を追加
        </Button>
      </div>

      {validationError && <p className="text-sm text-destructive">{validationError}</p>}
      <ErrorText error={save.error} />
      <div className="sticky bottom-4 flex justify-end rounded-lg border bg-background/90 p-3 backdrop-blur">
        <Button onClick={onSave} disabled={save.isPending}>
          <Save />
          保存
        </Button>
      </div>
    </div>
  );
}
