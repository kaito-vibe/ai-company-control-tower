import { QueryClient } from "@tanstack/react-query";
import { apiUrl } from "./utils";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(apiUrl(queryKey[0] as string));
        if (!res.ok) {
          throw new Error(`Request failed: ${res.statusText}`);
        }
        return res.json();
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
