import { useQuery } from "@tanstack/react-query";
import { client, ensureOk } from "@/lib/api";

export function useAuth() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await ensureOk(await client.api.auth.me.$get());
      return res.json();
    },
    staleTime: 60_000,
  });
  return {
    user: query.data?.user ?? null,
    devLoginEnabled: query.data?.devLoginEnabled ?? false,
    isLoading: query.isLoading,
    isAdmin: query.data?.user?.isAdmin ?? false,
  };
}
