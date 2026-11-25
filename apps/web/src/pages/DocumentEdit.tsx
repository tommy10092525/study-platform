import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorText, Loading, Textarea } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk } from "@/lib/api";
import { handleTabIndent } from "@/lib/textarea-indent";
import { cn } from "@/lib/utils";
import { useDocument } from "./DocumentView";

async function uploadImage(file: File) {
  const res = await ensureOk(await client.api.images.$post({ form: { file } }));
  return res.json();
}

export function DocumentEdit() {
  const { documentId = "" } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const docQuery = useDocument(documentId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (docQuery.data && !loaded) {
      setTitle(docQuery.data.title);
      setMarkdown(docQuery.data.markdown);
      setLoaded(true);
    }
  }, [docQuery.data, loaded]);

  // 未保存の変更があるときにタブを閉じようとしたら警告
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () =>
      (
        await ensureOk(
          await client.api.documents[":id"].$patch({ param: { id: documentId }, json: { title, markdown } }),
        )
      ).json(),
    onSuccess: (doc) => {
      setDirty(false);
      queryClient.setQueryData(["document", documentId], doc);
      queryClient.invalidateQueries({ queryKey: ["course", doc.courseId] });
    },
  });

  const upload = useMutation({
    mutationFn: async (images: File[]) => Promise.all(images.map(uploadImage)),
    onSuccess: (results, images) => {
      const text = results
        .map((r, i) => `![${images[i]?.name.replace(/\.[^.]+$/, "") ?? "image"}](${r.url})`)
        .join("\n");
      insertAtCursor(`\n${text}\n`);
    },
  });

  // Ctrl/Cmd + S で保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!save.isPending) save.mutate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? markdown.length;
    const end = el?.selectionEnd ?? markdown.length;
    const nextValue = markdown.slice(0, start) + text + markdown.slice(end);
    setMarkdown(nextValue);
    setDirty(true);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function handleFiles(list: FileList | null | undefined) {
    const images = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (images.length > 0) upload.mutate(images);
    return images.length > 0;
  }

  if (!isAdmin) return <Navigate to={`/documents/${documentId}`} replace />;
  if (docQuery.isLoading || !loaded) {
    return docQuery.error ? <ErrorText error={docQuery.error} /> : <Loading />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/documents/${documentId}`}
          className="text-sm text-muted-foreground hover:underline"
          onClick={(e) => {
            if (dirty && !window.confirm("保存されていない変更があります。破棄しますか？")) {
              e.preventDefault();
            }
          }}
        >
          ← 表示に戻る
        </Link>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">未保存の変更があります</span>}
          {save.isSuccess && !dirty && <span className="text-xs text-muted-foreground">保存しました</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => imageInput.current?.click()}
            disabled={upload.isPending}
          >
            <ImagePlus />
            {upload.isPending ? "アップロード中..." : "画像"}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              save.mutate(undefined, { onSuccess: () => navigate(`/documents/${documentId}`) })
            }
            disabled={save.isPending}
          >
            <Save />
            保存して閉じる
          </Button>
        </div>
      </div>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        placeholder="タイトル"
        className="text-lg font-semibold"
      />
      <ErrorText error={save.error ?? upload.error} />

      <div className="flex gap-1 md:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "secondary" : "ghost"} onClick={() => setTab(t)}>
            {t === "edit" ? "編集" : "プレビュー"}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Textarea
          ref={textareaRef}
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) =>
            handleTabIndent(e, (v) => {
              setMarkdown(v);
              setDirty(true);
            })
          }
          onPaste={(e) => {
            if (handleFiles(e.clipboardData.files)) e.preventDefault();
          }}
          onDrop={(e) => {
            if (handleFiles(e.dataTransfer.files)) e.preventDefault();
          }}
          placeholder={"# 見出し\n\nMarkdown で記述できます。画像は貼り付け・ドラッグ&ドロップでも挿入できます。"}
          className={cn("min-h-[70vh] font-mono text-sm", tab !== "edit" && "hidden md:flex")}
        />
        <div
          className={cn(
            "min-h-[70vh] overflow-auto rounded-md border p-4",
            tab !== "preview" && "hidden md:block",
          )}
        >
          {markdown.trim() ? (
            <Markdown>{markdown}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">プレビュー</p>
          )}
        </div>
      </div>
    </div>
  );
}
