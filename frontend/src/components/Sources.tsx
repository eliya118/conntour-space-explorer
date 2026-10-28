import { InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createSearch, errorMessage, fetchSearch, fetchSourceFacets, fetchSources } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { usePagedQuery } from "../api/usePagedQuery";
import { KeywordMatch, SearchResults, SearchSummary, Source, SourceQueryFilters } from "../types";
import BrowseFilters from "./BrowseFilters";
import ImageCard from "./ImageCard";
import ImageDetail from "./ImageDetail";
import SearchHistory from "./SearchHistory";
import VirtualGrid from "./VirtualGrid";

interface CardItem {
  source: Source;
  confidence?: number;
}

interface FilterForm {
  dateFrom: string;
  dateTo: string;
  center: string;
  keywords: string[];
  keywordMatch: KeywordMatch;
}

const EMPTY_FILTERS: FilterForm = { dateFrom: "", dateTo: "", center: "", keywords: [], keywordMatch: "or" };
const MIN_SEARCH_LENGTH = 3;

function queryFilters(form: FilterForm): SourceQueryFilters {
  const filters: SourceQueryFilters = {};
  if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
    return filters;
  }
  if (form.dateFrom) {
    filters.dateFrom = form.dateFrom;
  }
  if (form.dateTo) {
    filters.dateTo = form.dateTo;
  }
  if (form.center) {
    filters.center = form.center;
  }
  if (form.keywords.length > 0) {
    filters.keywords = [...form.keywords].sort((left, right) => left.localeCompare(right));
    filters.keywordMatch = form.keywordMatch;
  }
  return filters;
}

const Sources: React.FC = () => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Source | null>(null);
  const [filterForm, setFilterForm] = useState<FilterForm>(EMPTY_FILTERS);
  const queryRef = useRef(query);
  const submittedRef = useRef<string | null>(null);
  queryRef.current = query;
  const appliedFilters = useMemo(() => queryFilters(filterForm), [filterForm]);
  const browseKey = useMemo(() => queryKeys.sources(appliedFilters), [appliedFilters]);
  const facets = useQuery({
    queryKey: queryKeys.sourceFacets,
    queryFn: fetchSourceFacets,
  });

  const browse = usePagedQuery(browseKey, (offset) => fetchSources(offset, appliedFilters), {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.searches });
      if (data.query !== queryRef.current.trim()) {
        return;
      }
      const seeded: InfiniteData<SearchResults> = {
        pages: [data],
        pageParams: [0],
      };
      queryClient.setQueryData(queryKeys.searchResults(data.id), seeded);
      setActiveSearchId(data.id);
      setActiveQuery(data.query);
      setNotice(null);
    },
    onError: (error, failedQuery) => {
      submittedRef.current = failedQuery;
      setActiveSearchId(null);
      setActiveQuery(null);
      setNotice(errorMessage(error));
    },
  });

  const { mutate: submitSearch } = search;
  const showBrowse = activeSearchId === null;
  const activeRequest = showBrowse ? browse : results;
  const cards: CardItem[] = showBrowse
    ? (browse.data?.pages.flatMap((page) => page.items) ?? []).map((source) => ({ source }))
    : (results.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
        source: item.source,
        confidence: item.confidence,
      }));
  const total = activeRequest.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(() => {
      if (trimmed.length < MIN_SEARCH_LENGTH) {
        submittedRef.current = null;
        setActiveSearchId(null);
        setActiveQuery(null);
        setNotice(null);
        return;
      }
      if (trimmed === submittedRef.current || trimmed === activeQuery) {
        return;
      }
      submittedRef.current = trimmed;
      submitSearch(trimmed);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, activeQuery, submitSearch]);

  const showBrowseAll = () => {
    submittedRef.current = null;
    setQuery("");
    setActiveSearchId(null);
    setActiveQuery(null);
    setNotice(null);
  };

  const openHistory = (item: SearchSummary) => {
    submittedRef.current = item.query;
    setActiveSearchId(item.id);
    setActiveQuery(item.query);
    setQuery(item.query);
    setNotice(null);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <header className="shrink-0 border-b bg-white px-4 py-4">
        <div>
          <h1 className="text-3xl font-bold">NASA Space Images</h1>
          <p className="text-sm text-gray-500">
            {showBrowse ? "Browse the collection" : `Results for “${activeQuery ?? ""}”`}
          </p>
        </div>
        {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search images"
            aria-label="Search images"
            className="h-9 w-56 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900"
          />
          {showBrowse && (
            <BrowseFilters
              dateFrom={filterForm.dateFrom}
              dateTo={filterForm.dateTo}
              center={filterForm.center}
              selectedKeywords={filterForm.keywords}
              keywordMatch={filterForm.keywordMatch}
              centers={facets.data?.centers ?? []}
              keywords={facets.data?.keywords ?? []}
              dateMin={facets.data?.date_min ?? null}
              dateMax={facets.data?.date_max ?? null}
              onDateChange={(dateFrom, dateTo) => setFilterForm((current) => ({ ...current, dateFrom, dateTo }))}
              onCenterChange={(center) => setFilterForm((current) => ({ ...current, center }))}
              onKeywordChange={(keywords) => setFilterForm((current) => ({ ...current, keywords }))}
              onKeywordMatchChange={(keywordMatch) => setFilterForm((current) => ({ ...current, keywordMatch }))}
              onClear={() => setFilterForm(EMPTY_FILTERS)}
            />
          )}
        </div>
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
              resetKey={showBrowse ? browseKey : activeSearchId}
              hasNextPage={activeRequest.hasNextPage}
              isFetchingNextPage={activeRequest.isFetchingNextPage}
              fetchNextPage={() => {
                activeRequest.fetchNextPage();
              }}
              empty={
                showBrowse
                  ? Object.keys(appliedFilters).length > 0
                    ? "No images match these filters."
                    : "No images are available."
                  : "No images matched that search."
              }
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
