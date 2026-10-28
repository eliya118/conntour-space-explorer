import { QueryKey, useInfiniteQuery } from "@tanstack/react-query";

import { nextOffset } from "./client";

interface PagedResponse {
  offset: number;
  items: unknown[];
  total: number;
}

interface PagedQueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function usePagedQuery<TPage extends PagedResponse>(
  queryKey: QueryKey,
  fetchPage: (offset: number) => Promise<TPage>,
  options?: PagedQueryOptions,
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    enabled: options?.enabled,
    staleTime: options?.staleTime,
  });
}
