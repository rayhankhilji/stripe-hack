"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppError } from "@ghost/shared";
import { useState, type ReactNode } from "react";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000,
        refetchOnWindowFocus: false,
        // Auth, validation and state errors will not fix themselves on retry.
        retry: (count, err) => !(err instanceof AppError && err.status < 500) && count < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
