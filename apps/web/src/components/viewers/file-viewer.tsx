import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { Markdown } from "@/components/markdown";
import { ErrorText, Loading } from "@/components/ui/misc";

const PptxViewer = lazy(() =>
  import("./office-viewers").then((m) => ({ default: m.PptxViewer })),
);
const DocxViewer = lazy(() =>
  import("./office-viewers").then((m) => ({ default: m.DocxViewer })),
);

/** ブラウザ内で表示できる形式 */
export const PREVIEWABLE_FORMATS = [
  "pdf",
  "pptx",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "mp4",
  "webm",
  "mp3",
  "md",
  "txt",
  "csv",
] as const;

function TextViewer({ url, markdown }: { url: string; markdown: boolean }) {
  const query = useQuery({
    queryKey: ["file-text", url],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`ファイルの取得に失敗しました (${res.status})`);
      return res.text();
    },
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorText error={query.error} />;
  return markdown ? (
    <Markdown>{query.data ?? ""}</Markdown>
  ) : (
    <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 text-sm">{query.data}</pre>
  );
}

export function FileViewer({ url, format, title }: { url: string; format: string; title: string }) {
  switch (format) {
    case "pdf":
      // ブラウザ内蔵の PDF ビューア (ページ送り・拡大・検索に対応)
      return <iframe src={url} title={title} className="h-[80vh] w-full rounded-md border" />;
    case "pptx":
      return (
        <Suspense fallback={<Loading />}>
          <PptxViewer url={url} />
        </Suspense>
      );
    case "docx":
      return (
        <Suspense fallback={<Loading />}>
          <DocxViewer url={url} />
        </Suspense>
      );
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return <img src={url} alt={title} className="max-w-full rounded-md border" />;
    case "mp4":
    case "webm":
      // biome-ignore lint/a11y/useMediaCaption: 教材動画に字幕トラックはない
      return <video src={url} controls className="w-full rounded-md border" />;
    case "mp3":
      // biome-ignore lint/a11y/useMediaCaption: 同上
      return <audio src={url} controls className="w-full" />;
    case "md":
      return <TextViewer url={url} markdown />;
    case "txt":
    case "csv":
      return <TextViewer url={url} markdown={false} />;
    default:
      return (
        <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          この形式 (.{format || "不明"}) はブラウザでプレビューできません。ダウンロードしてご覧ください。
          {format === "ppt" && " (.ppt は .pptx か PDF に変換してアップロードするとプレビューできます)"}
        </p>
      );
  }
}
