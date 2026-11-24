import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ApiError } from "./lib/api";
import "./index.css";

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // セッション切れ (401) を検知したら認証状態を取り直し、ログイン画面へ戻す
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
