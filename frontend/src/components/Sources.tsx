import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { createSearch, errorMessage, fetchSearch, fetchSources } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { usePagedQuery } from "../api/usePagedQuery";
import { SearchResults, SearchSummary, Source } from "../types";
import ImageCard from "./ImageCard";
import ImageDetail from "./ImageDetail";
import SearchHistory from "./SearchHistory";
import VirtualGrid from "./VirtualGrid";

interface CardItem {
  source: Source;
  confidence?: number;
}

const Sources: React.FC = () => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Source | null>(null);

  const browse = usePagedQuery(queryKeys.sources, fetchSources, {
    enabled: activeSearchId === null,
  });

  const results = usePagedQuery(
    queryKeys.searchResults(activeSearchId),
    (offset) => fetchSearch(activeSearchId as number, offset),
    { enabled: activeSearchId !== null, staleTime: 30_000 },
  );

  const search = useMutation({
    mutationFn: createSearch,
    onSuccess: (data) => {
      const seeded: InfiniteData<SearchResults> = {
        pages: [data],
        pageParams: [0],
      };
      queryClient.setQueryData(queryKeys.searchResults(data.id), seeded);
      queryClient.invalidateQueries({ queryKey: queryKeys.searches });
      setActiveSearchId(data.id);
      setActiveQuery(data.query);
      setNotice(null);
    },
    onError: (error) => {
      setActiveSearchId(null);
      setActiveQuery(null);
      setNotice(errorMessage(error));
    },
  });

  const showBrowse = activeSearchId === null;
  const activeRequest = showBrowse ? browse : results;
  const cards: CardItem[] = showBrowse
    ? (browse.data?.pages.flatMap((page) => page.items) ?? []).map((source) => ({ source }))
    : (results.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
        source: item.source,
        confidence: item.confidence,
      }));
  const total = activeRequest.data?.pages[0]?.total ?? 0;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setActiveSearchId(null);
      setActiveQuery(null);
      setNotice(null);
      return;
    }
    search.mutate(trimmed);
  };

  const showBrowseAll = () => {
    setActiveSearchId(null);
    setActiveQuery(null);
    setNotice(null);
  };

  const openHistory = (item: SearchSummary) => {
    setActiveSearchId(item.id);
    setActiveQuery(item.query);
    setQuery(item.query);
    setNotice(null);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <header className="shrink-0 border-b bg-white px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">NASA Space Images</h1>
            <p className="text-sm text-gray-500">
              {showBrowse ? "Browse the collection" : `Results for “${activeQuery ?? ""}”`}
            </p>
          </div>
          <form className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl" onSubmit={submitSearch}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Try "images of Mars rovers"'
              aria-label="Search images"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
              disabled={search.isPending}
            >
              {search.isPending ? "Searching..." : "Search"}
            </button>
            {!showBrowse && (
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
                onClick={showBrowseAll}
              >
                Browse all
              </button>
            )}
          </form>
        </div>
        {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex h-64 shrink-0 flex-col border-b bg-white lg:h-auto lg:min-h-0 lg:w-80 lg:border-b-0 lg:border-r">
          <SearchHistory
            activeSearchId={activeSearchId}
            onSelect={openHistory}
            onDeleted={(searchId) => {
              if (activeSearchId === searchId) {
                showBrowseAll();
              }
            }}
          />
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeRequest.isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
            </div>
          )}
          {activeRequest.isError && (
            <p className="p-4 text-center text-red-500">{errorMessage(activeRequest.error)}</p>
          )}
          {activeRequest.isSuccess && (
            <VirtualGrid
              items={cards}
              getKey={(item) => item.source.id}
              resetKey={activeSearchId ?? "browse"}
              hasNextPage={activeRequest.hasNextPage}
              isFetchingNextPage={activeRequest.isFetchingNextPage}
              fetchNextPage={() => {
                activeRequest.fetchNextPage();
              }}
              empty={showBrowse ? "No images are available." : "No images matched that search."}
              footer={
                activeRequest.isFetchingNextPage
                  ? "Loading more..."
                  : `Showing ${cards.length} of ${total}`
              }
              renderItem={(item) => (
                <ImageCard
                  source={item.source}
                  confidence={item.confidence}
                  onOpen={() => setSelected(item.source)}
                />
              )}
            />
          )}
        </main>
      </div>

      {selected && (
        <ImageDetail
          source={selected}
          onOpenSource={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default Sources;
