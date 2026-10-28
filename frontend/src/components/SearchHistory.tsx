import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { deleteSearch, errorMessage, fetchSearches } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { usePagedQuery } from "../api/usePagedQuery";
import { SearchSummary } from "../types";
import VirtualGrid from "./VirtualGrid";

interface SearchHistoryProps {
  activeSearchId: number | null;
  onSelect: (search: SearchSummary) => void;
  onDeleted: (searchId: number) => void;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ activeSearchId, onSelect, onDeleted }) => {
  const queryClient = useQueryClient();
  const history = usePagedQuery(queryKeys.searches, fetchSearches);

  const remove = useMutation({
    mutationFn: deleteSearch,
    onSuccess: (_data, searchId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.searches });
      queryClient.removeQueries({ queryKey: queryKeys.searchResults(searchId) });
      onDeleted(searchId);
    },
  });

  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const total = history.data?.pages[0]?.total ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <h2 className="shrink-0 border-b px-4 py-3 text-lg font-semibold">Search history</h2>
      {history.isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
        </div>
      )}
      {history.isError && <p className="px-4 py-4 text-sm text-red-500">{errorMessage(history.error)}</p>}
      {remove.isError && <p className="px-4 py-2 text-sm text-red-500">{errorMessage(remove.error)}</p>}
      {history.isSuccess && (
        <VirtualGrid
          items={items}
          getKey={(item) => item.id}
          columnsMode="single"
          estimateSize={88}
          hasNextPage={history.hasNextPage}
          isFetchingNextPage={history.isFetchingNextPage}
          fetchNextPage={() => {
            history.fetchNextPage();
          }}
          empty="Searches you run will show up here."
          footer={
            history.isFetchingNextPage ? "Loading more..." : items.length > 0 ? `${items.length} of ${total}` : null
          }
          renderItem={(item) => {
            const selected = item.id === activeSearchId;
            return (
              <div
                className={`flex items-start gap-2 rounded border px-3 py-2 ${
                  selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(item)}
                >
                  <span className="block truncate font-medium">{item.query}</span>
                  <span className="block text-xs text-gray-500">
                    {item.result_count} results · {new Date(item.created_at).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-50"
                  aria-label={`Delete search ${item.query}`}
                  disabled={remove.isPending && remove.variables === item.id}
                  onClick={() => remove.mutate(item.id)}
                >
                  Delete
                </button>
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export default SearchHistory;
