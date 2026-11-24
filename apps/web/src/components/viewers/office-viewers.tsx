// pptx-preview / docx-preview はサイズが大きいので、このファイルごと遅延読み込みする (file-viewer.tsx 参照)
import { renderAsync } from "docx-preview";
import { init } from "pptx-preview";
import { useEffect, useRef, useState } from "react";
import { ErrorText, Loading } from "@/components/ui/misc";

async function fetchArrayBuffer(url: string, signal: AbortSignal) {
  const res = await fetch(url, { credentials: "include", signal });
  if (!res.ok) throw new Error(`ファイルの取得に失敗しました (${res.status})`);
  return res.arrayBuffer();
}

function useOfficeRender(
  url: string,
  render: (el: HTMLDivElement, data: ArrayBuffer) => Promise<(() => void) | undefined>,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "done" | Error>("loading");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controller = new AbortController();
    let cleanup: (() => void) | undefined;
    setState("loading");
    fetchArrayBuffer(url, controller.signal)
      .then(async (data) => {
        if (controller.signal.aborted) return;
        el.innerHTML = "";
        cleanup = await render(el, data);
        setState("done");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setState(e instanceof Error ? e : new Error("表示に失敗しました"));
      });
    return () => {
      controller.abort();
      cleanup?.();
      el.innerHTML = "";
    };
  }, [url, render]);

  return { ref, state };
}

const renderPptx = async (el: HTMLDivElement, data: ArrayBuffer) => {
  // 縦スクロールバー分を差し引いて横スクロールが出ないようにする
  const width = Math.min((el.clientWidth || 984) - 24, 960);
  const previewer = init(el, { width, height: Math.round((width * 9) / 16), mode: "list" });
  await previewer.preview(data);
  return () => previewer.destroy();
};

const renderDocx = async (el: HTMLDivElement, data: ArrayBuffer) => {
  await renderAsync(data, el, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true });
  return undefined;
};

function OfficeFrame({
  url,
  render,
}: {
  url: string;
  render: (el: HTMLDivElement, data: ArrayBuffer) => Promise<(() => void) | undefined>;
}) {
  const { ref, state } = useOfficeRender(url, render);
  return (
    <div className="flex flex-col gap-2">
      {state === "loading" && <Loading />}
      {state instanceof Error && (
        <>
          <ErrorText error={state} />
          <p className="text-sm text-muted-foreground">
            このファイルはブラウザで表示できませんでした。ダウンロードしてご覧ください。
          </p>
        </>
      )}
      <div ref={ref} className="w-full overflow-x-auto rounded-md border bg-muted/30" />
    </div>
  );
}

export function PptxViewer({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        ※ PowerPoint をブラウザ上で簡易描画しています。アニメーション・一部の図形やフォントは再現されません。
        正確な表示が必要な場合はダウンロードするか、PDF 版をアップロードしてください。
      </p>
      <OfficeFrame url={url} render={renderPptx} />
    </div>
  );
}

export function DocxViewer({ url }: { url: string }) {
  return <OfficeFrame url={url} render={renderDocx} />;
}
