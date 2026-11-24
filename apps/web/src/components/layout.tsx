import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, LogOut } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge, Loading } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client } from "@/lib/api";

/** ログイン必須エリアのレイアウト。未ログインなら /login へ */
export function Layout() {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Loading />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const logout = async () => {
    await client.api.auth.logout.$post();
    queryClient.clear();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-5" />
            Study Platform
          </Link>
          <div className="ml-auto flex items-center gap-3">
            {user.avatar && (
              <img src={user.avatar} alt="" className="size-7 rounded-full" />
            )}
            <span className="hidden text-sm sm:inline">{user.displayName}</span>
            {isAdmin && <Badge>管理者</Badge>}
            <Button variant="ghost" size="icon" onClick={logout} title="ログアウト">
              <LogOut />
            </Button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
