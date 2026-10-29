import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { memo, useCallback, useMemo } from "react";

import { deleteSearch, errorMessage, fetchSearches } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { usePagedQuery } from "../api/usePagedQuery";
import { SearchSummary } from "../types";
import Tooltip from "./Tooltip";
import VirtualGrid from "./VirtualGrid";

interface SearchHistoryProps {
  activeSearchId: number | null;
  onSelect: (search: SearchSummary) => void;
  onDeleted: (searchId: number) => void;
  onClose: () => void;
}

const SearchHistory = memo(function SearchHistory({
  activeSearchId,
  onSelect,
  onDeleted,
  onClose,
}: SearchHistoryProps) {
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
  const { fetchNextPage: fetchHistoryPage } = history;
  const { mutate: deleteHistoryItem, isPending: deletePending, variables: deleteVariables } = remove;

  const items = useMemo(
    () => history.data?.pages.flatMap((page) => page.items) ?? [],
    [history.data],
  );
  const total = history.data?.pages[0]?.total ?? 0;
  const getHistoryKey = useCallback((item: SearchSummary) => item.id, []);
  const fetchHistoryNext = useCallback(() => {
    fetchHistoryPage();
  }, [fetchHistoryPage]);
  const renderHistoryItem = useCallback(
    (item: SearchSummary) => {
      const selected = item.id === activeSearchId;
      return (
        <div
          className={`flex items-start gap-2 rounded border px-3 py-2 ${
            selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
          }`}
        >
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(item)}>
            <span className="block truncate font-medium">{item.query}</span>
            <span className="block text-xs text-gray-500">
              {item.result_count} results · {new Date(item.created_at).toLocaleString()}
            </span>
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label={`Delete search ${item.query}`}
            disabled={deletePending && deleteVariables === item.id}
            onClick={() => deleteHistoryItem(item.id)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4.5 6.5h11" strokeLinecap="round" />
              <path d="M8 6.4V5.2A1.2 1.2 0 0 1 9.2 4h1.6A1.2 1.2 0 0 1 12 5.2v1.2" strokeLinecap="round" />
              <path d="M6.2 6.5 6.8 15a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.5" strokeLinejoin="round" />
              <path d="M8.6 9.2v3.6M11.4 9.2v3.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      );
    },
    [activeSearchId, onSelect, deletePending, deleteVariables, deleteHistoryItem],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Search history</h2>
        <Tooltip label="Close search history" side="bottom">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close search history"
            onClick={(event) => {
              event.currentTarget.blur();
              onClose();
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5 7 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </Tooltip>
      </div>
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
          getKey={getHistoryKey}
          columnsMode="single"
          estimateSize={88}
          hasNextPage={history.hasNextPage}
          isFetchingNextPage={history.isFetchingNextPage}
          fetchNextPage={fetchHistoryNext}
          empty="Searches you run will show up here."
          footer={
            history.isFetchingNextPage ? "Loading more..." : items.length > 0 ? `${items.length} of ${total}` : null
          }
          renderItem={renderHistoryItem}
        />
      )}
    </div>
  );
});

export default SearchHistory;
