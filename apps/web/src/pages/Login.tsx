import { useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, ErrorText, Loading } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { apiUrl, client, ensureOk } from "@/lib/api";

const ERROR_MESSAGES: Record<string, string> = {
  not_member: "サークルの Discord サーバーに参加しているアカウントでログインしてください。",
  denied: "Discord での認可がキャンセルされました。",
  invalid_state: "ログインの有効期限が切れました。もう一度お試しください。",
};

export function Login() {
  const { user, isLoading, devLoginEnabled } = useAuth();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [devName, setDevName] = useState("dev-admin");
  const [devError, setDevError] = useState<unknown>(null);

  const next = params.get("next") ?? "/";
  const error = params.get("error");

  if (isLoading) return <Loading />;
  if (user) return <Navigate to={next.startsWith("/") ? next : "/"} replace />;

  const devLogin = async (isAdmin: boolean) => {
    try {
      setDevError(null);
      await ensureOk(await client.api.auth["dev-login"].$post({ json: { name: devName, isAdmin } }));
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setDevError(e);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <Card className="flex w-full max-w-sm flex-col gap-6 p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen className="size-8" />
          <h1 className="text-xl font-semibold">Study Platform</h1>
          <p className="text-sm text-muted-foreground">
            サークルメンバー専用の学習プラットフォームです。
          </p>
        </div>
        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {ERROR_MESSAGES[error] ?? "ログインに失敗しました。もう一度お試しください。"}
          </p>
        )}
        <Button asChild size="lg" className="bg-[#5865F2] text-white hover:bg-[#4752c4]">
          <a href={apiUrl(`/api/auth/login?next=${encodeURIComponent(next)}`)}>
            Discord でログイン
          </a>
        </Button>

        {devLoginEnabled && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              開発用ログイン (DEV_AUTH_BYPASS=true のときのみ表示)
            </p>
            <Input value={devName} onChange={(e) => setDevName(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => devLogin(true)}>
                管理者として
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => devLogin(false)}>
                メンバーとして
              </Button>
            </div>
            <ErrorText error={devError} />
          </div>
        )}
      </Card>
    </div>
  );
}
