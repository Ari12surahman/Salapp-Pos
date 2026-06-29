"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes (data remains fresh for 5 mins)
        gcTime: 1000 * 60 * 60 * 24, // Keep in memory for 24 hours
        refetchOnWindowFocus: true, // Auto refetch when switching back to this tab
        retry: 1
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
