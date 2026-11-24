import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { ErrorText, Loading } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk, formatDate } from "@/lib/api";

export function useDocument(id: string) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: async () =>
      (await ensureOk(await client.api.documents[":id"].$get({ param: { id } }))).json(),
  });
}

export function DocumentView() {
  const { documentId = "" } = useParams();
  const { isAdmin } = useAuth();
  const docQuery = useDocument(documentId);

  if (docQuery.isLoading) return <Loading />;
  if (docQuery.error || !docQuery.data) return <ErrorText error={docQuery.error} />;
  const doc = docQuery.data;

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to={`/courses/${doc.courseId}`} className="text-sm text-muted-foreground hover:underline">
          ← コースに戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            <p className="text-xs text-muted-foreground">最終更新: {formatDate(doc.updatedAt)}</p>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/documents/${doc.id}/edit`}>
                <Pencil />
                編集
              </Link>
            </Button>
          )}
        </div>
      </div>
      {doc.markdown.trim() ? (
        <Markdown>{doc.markdown}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">本文はまだありません。</p>
      )}
    </article>
  );
}
