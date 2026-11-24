import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-xl border bg-card text-card-foreground shadow-xs", className)}
      {...props}
    />
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor は呼び出し側で指定
    <label
      data-slot="label"
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    />
  );
}

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="text-sm text-destructive">
      {error instanceof Error ? error.message : "エラーが発生しました"}
    </p>
  );
}

function Loading() {
  return <p className="text-sm text-muted-foreground">読み込み中...</p>;
}

export { Badge, Card, ErrorText, Label, Loading, Textarea };
