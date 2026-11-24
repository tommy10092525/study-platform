import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Markdown を表示する。生 HTML は描画しない (react-markdown のデフォルト) ため XSS の心配はない。
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-neutral max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node: _node, ...props }) =>
            /^https?:\/\//.test(props.href ?? "") ? (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ) : (
              <a {...props} />
            ),
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" alt={props.alt ?? ""} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
