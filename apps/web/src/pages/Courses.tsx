import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, ErrorText, Loading, Textarea } from "@/components/ui/misc";
import { useAuth } from "@/hooks/use-auth";
import { client, ensureOk } from "@/lib/api";

export function Courses() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await ensureOk(await client.api.courses.$get())).json(),
  });

  const createCourse = useMutation({
    mutationFn: async () =>
      (await ensureOk(await client.api.courses.$post({ json: { title, description } }))).json(),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">コース一覧</h1>
        {isAdmin && (
          <Button onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
            <Plus />
            コースを作成
          </Button>
        )}
      </div>

      {open && (
        <Card className="p-4">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) createCourse.mutate();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="コース名" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明 (任意)"
            />
            <ErrorText error={createCourse.error} />
            <Button type="submit" disabled={createCourse.isPending} className="self-end">
              作成
            </Button>
          </form>
        </Card>
      )}

      {coursesQuery.isLoading && <Loading />}
      <ErrorText error={coursesQuery.error} />

      <div className="grid gap-3 sm:grid-cols-2">
        {coursesQuery.data?.map((course) => (
          <Link key={course.id} to={`/courses/${course.id}`}>
            <Card className="h-full p-4 transition-colors hover:bg-accent">
              <h2 className="font-semibold">{course.title}</h2>
              {course.description && (
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {course.description}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
      {coursesQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">コースはまだありません。</p>
      )}
    </div>
  );
}
