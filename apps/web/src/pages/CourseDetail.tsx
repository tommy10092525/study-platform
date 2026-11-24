import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileText, NotebookPen, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, ErrorText, Loading, Textarea } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk, formatBytes, formatDate } from "@/lib/api";

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold [&_svg]:size-5">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ to, title, meta, onDelete }: { to: string; title: string; meta?: ReactNode; onDelete?: () => void }) {
  return (
    <li className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-accent/50">
      <Link to={to} className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{title}</span>
        {meta && <span className="flex items-center gap-2 text-xs text-muted-foreground">{meta}</span>}
      </Link>
      {onDelete && (
        <Button variant="ghost" size="icon" onClick={onDelete} title="削除">
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function CourseDetail() {
  const { courseId = "" } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  const queryKey = ["course", courseId];
  const courseQuery = useQuery({
    queryKey,
    queryFn: async () =>
      (await ensureOk(await client.api.courses[":id"].$get({ param: { id: courseId } }))).json(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateCourse = useMutation({
    mutationFn: async () =>
      ensureOk(await client.api.courses[":id"].$patch({ param: { id: courseId }, json: form })),
    onSuccess: () => {
      setEditing(false);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const deleteCourse = useMutation({
    mutationFn: async () =>
      ensureOk(await client.api.courses[":id"].$delete({ param: { id: courseId } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      navigate("/");
    },
  });

  const createDocument = useMutation({
    mutationFn: async () => {
      const res = await ensureOk(
        await client.api.documents.$post({
          json: { courseId, title: "新しいドキュメント", markdown: "" },
        }),
      );
      return res.json();
    },
    onSuccess: (doc) => navigate(`/documents/${doc.id}/edit`),
  });

  const createQuiz = useMutation({
    mutationFn: async () => {
      const res = await ensureOk(
        await client.api.quizzes.$post({ json: { courseId, title: "新しいテスト", description: "" } }),
      );
      return res.json();
    },
    onSuccess: (quiz) => navigate(`/quizzes/${quiz.id}/edit`),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) =>
      ensureOk(await client.api.files.$post({ form: { courseId, file } })),
    onSettled: () => {
      if (fileInput.current) fileInput.current.value = "";
      invalidate();
    },
  });

  const deleteItem = useMutation({
    mutationFn: async ({ kind, id }: { kind: "documents" | "files" | "quizzes"; id: string }) => {
      const param = { param: { id } };
      if (kind === "documents") return ensureOk(await client.api.documents[":id"].$delete(param));
      if (kind === "files") return ensureOk(await client.api.files[":id"].$delete(param));
      return ensureOk(await client.api.quizzes[":id"].$delete(param));
    },
    onSuccess: invalidate,
  });

  const confirmDelete = (kind: "documents" | "files" | "quizzes", id: string, title: string) => {
    if (window.confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) {
      deleteItem.mutate({ kind, id });
    }
  };

  if (courseQuery.isLoading) return <Loading />;
  if (courseQuery.error || !courseQuery.data) return <ErrorText error={courseQuery.error} />;
  const course = courseQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← コース一覧
        </Link>
        {editing ? (
          <Card className="flex flex-col gap-3 p-4">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <ErrorText error={updateCourse.error} />
            <div className="flex justify-between gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm(`コース「${course.title}」と、その中の教材・テスト・受験履歴をすべて削除しますか？`)) {
                    deleteCourse.mutate();
                  }
                }}
              >
                コースを削除
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>
                  キャンセル
                </Button>
                <Button onClick={() => updateCourse.mutate()} disabled={updateCourse.isPending}>
                  保存
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{course.title}</h1>
              {course.description && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {course.description}
                </p>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                title="コースを編集"
                onClick={() => {
                  setForm({ title: course.title, description: course.description });
                  setEditing(true);
                }}
              >
                <Pencil />
              </Button>
            )}
          </div>
        )}
      </div>

      <ErrorText error={deleteItem.error} />

      <Section
        icon={<NotebookPen />}
        title="ドキュメント"
        action={
          isAdmin && (
            <Button size="sm" variant="outline" onClick={() => createDocument.mutate()} disabled={createDocument.isPending}>
              <Plus />
              新規作成
            </Button>
          )
        }
      >
        <ErrorText error={createDocument.error} />
        {course.documents.length === 0 ? (
          <Empty>ドキュメントはまだありません。</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {course.documents.map((d) => (
              <Row
                key={d.id}
                to={`/documents/${d.id}`}
                title={d.title}
                meta={`更新: ${formatDate(d.updatedAt)}`}
                onDelete={isAdmin ? () => confirmDelete("documents", d.id, d.title) : undefined}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<FileText />}
        title="資料ファイル"
        action={
          isAdmin && (
            <>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile.mutate(file);
                }}
              />
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploadFile.isPending}>
                <Upload />
                {uploadFile.isPending ? "アップロード中..." : "アップロード"}
              </Button>
            </>
          )
        }
      >
        <ErrorText error={uploadFile.error} />
        {course.files.length === 0 ? (
          <Empty>資料ファイルはまだありません。(PDF / PPTX / DOCX / 画像 / 動画など)</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {course.files.map((f) => (
              <Row
                key={f.id}
                to={`/files/${f.id}`}
                title={f.title}
                meta={
                  <>
                    <Badge>{f.format.toUpperCase() || "FILE"}</Badge>
                    {formatBytes(f.size)}
                  </>
                }
                onDelete={isAdmin ? () => confirmDelete("files", f.id, f.title) : undefined}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<ClipboardList />}
        title="テスト"
        action={
          isAdmin && (
            <Button size="sm" variant="outline" onClick={() => createQuiz.mutate()} disabled={createQuiz.isPending}>
              <Plus />
              新規作成
            </Button>
          )
        }
      >
        <ErrorText error={createQuiz.error} />
        {course.quizzes.length === 0 ? (
          <Empty>テストはまだありません。</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {course.quizzes.map((q) => (
              <Row
                key={q.id}
                to={`/quizzes/${q.id}`}
                title={q.title}
                meta={q.description || undefined}
                onDelete={isAdmin ? () => confirmDelete("quizzes", q.id, q.title) : undefined}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
