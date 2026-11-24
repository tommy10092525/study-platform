import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge, ErrorText, Loading } from "@/components/ui/misc";
import { FileViewer } from "@/components/viewers/file-viewer";
import { apiUrl, client, ensureOk, formatBytes } from "@/lib/api";

export function FileView() {
  const { fileId = "" } = useParams();
  const fileQuery = useQuery({
    queryKey: ["file", fileId],
    queryFn: async () =>
      (await ensureOk(await client.api.files[":id"].$get({ param: { id: fileId } }))).json(),
  });

  if (fileQuery.isLoading) return <Loading />;
  if (fileQuery.error || !fileQuery.data) return <ErrorText error={fileQuery.error} />;
  const file = fileQuery.data;
  const contentUrl = apiUrl(`/api/files/${file.id}/content`);

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/courses/${file.courseId}`} className="text-sm text-muted-foreground hover:underline">
        ← コースに戻る
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{file.title}</h1>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge>{file.format.toUpperCase() || "FILE"}</Badge>
            {file.filename} · {formatBytes(file.size)}
          </p>
        </div>
        <div className="flex gap-2">
          {file.format === "pdf" && (
            <Button asChild variant="outline" size="sm">
              <a href={contentUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                新しいタブで開く
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={`${contentUrl}?download=1`}>
              <Download />
              ダウンロード
            </a>
          </Button>
        </div>
      </div>
      <FileViewer url={contentUrl} format={file.format} title={file.title} />
    </div>
  );
}
