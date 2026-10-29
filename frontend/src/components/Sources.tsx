import HistoryIcon from "@mui/icons-material/History";
import { InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSearch, errorMessage, fetchSearch, fetchSourceFacets, fetchSources } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { usePagedQuery } from "../api/usePagedQuery";
import { KeywordMatch, SearchResults, SearchSummary, Source, SourceQueryFilters } from "../types";
import BrowseFilters from "./BrowseFilters";
import ImageCard from "./ImageCard";
import ImageDetail from "./ImageDetail";
import SearchHistory from "./SearchHistory";
import Tooltip from "./Tooltip";
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
const EMPTY_STRINGS: string[] = [];
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
  const [historyOpen, setHistoryOpen] = useState(true);
  const queryRef = useRef(query);
  const submittedRef = useRef<string | null>(null);
  const historyPanelRef = useRef<HTMLElement>(null);
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
      if (failedQuery !== queryRef.current.trim()) {
        return;
      }
      submittedRef.current = failedQuery;
      setActiveSearchId(null);
      setActiveQuery(null);
      setNotice(errorMessage(error));
    },
  });

  const { mutate: submitSearch } = search;
  const { fetchNextPage: fetchBrowseNext } = browse;
  const { fetchNextPage: fetchResultsNext } = results;
  const showBrowse = activeSearchId === null;
  const activeRequest = showBrowse ? browse : results;
  const cards = useMemo<CardItem[]>(() => {
    if (showBrowse) {
      return (browse.data?.pages.flatMap((page) => page.items) ?? []).map((source) => ({ source }));
    }
    return (results.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
      source: item.source,
      confidence: item.confidence,
    }));
  }, [showBrowse, browse.data, results.data]);
  const total = activeRequest.data?.pages[0]?.total ?? 0;
  const facetCenters = facets.data?.centers ?? EMPTY_STRINGS;
  const facetKeywords = facets.data?.keywords ?? EMPTY_STRINGS;

  useEffect(() => {
    const panel = historyPanelRef.current;
    if (!panel) return;
    if (historyOpen) panel.removeAttribute("inert");
    else panel.setAttribute("inert", "");
  }, [historyOpen]);

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

  const showBrowseAll = useCallback(() => {
    submittedRef.current = null;
    setQuery("");
    setActiveSearchId(null);
    setActiveQuery(null);
    setNotice(null);
  }, []);

  const openHistory = useCallback((item: SearchSummary) => {
    submittedRef.current = item.query;
    setActiveSearchId(item.id);
    setActiveQuery(item.query);
    setQuery(item.query);
    setNotice(null);
  }, []);

  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const openHistoryPanel = useCallback(() => setHistoryOpen(true), []);
  const closeDetail = useCallback(() => setSelected(null), []);

  const handleHistoryDeleted = useCallback(
    (searchId: number) => {
      if (activeSearchId === searchId) {
        showBrowseAll();
      }
    },
    [activeSearchId, showBrowseAll],
  );

  const onDateChange = useCallback((dateFrom: string, dateTo: string) => {
    setFilterForm((current) => ({ ...current, dateFrom, dateTo }));
  }, []);
  const onCenterChange = useCallback((center: string) => {
    setFilterForm((current) => ({ ...current, center }));
  }, []);
  const onKeywordChange = useCallback((keywords: string[]) => {
    setFilterForm((current) => ({ ...current, keywords }));
  }, []);
  const onKeywordMatchChange = useCallback((keywordMatch: KeywordMatch) => {
    setFilterForm((current) => ({ ...current, keywordMatch }));
  }, []);
  const onClearFilters = useCallback(() => setFilterForm(EMPTY_FILTERS), []);

  const getCardKey = useCallback((item: CardItem) => item.source.id, []);
  const fetchCardsNext = useCallback(() => {
    if (activeSearchId === null) {
      fetchBrowseNext();
    } else {
      fetchResultsNext();
    }
  }, [activeSearchId, fetchBrowseNext, fetchResultsNext]);
  const renderCard = useCallback(
    (item: CardItem) => (
      <ImageCard source={item.source} confidence={item.confidence} onOpen={setSelected} />
    ),
    [],
  );

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
          <button
            type="button"
            className={`inline-flex h-9 items-center gap-2 rounded-full border bg-white px-3 text-sm text-gray-700 hover:border-gray-300 ${
              historyOpen ? "border-gray-900" : "border-gray-200"
            }`}
            aria-expanded={historyOpen}
            aria-controls="search-history"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <HistoryIcon style={{ fontSize: 18 }} />
            {historyOpen ? "Close Search History" : "Open Search History"}
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search images"
            aria-label="Search images"
            className="h-9 w-56 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900"
          />
          {showBrowse ? (
            <BrowseFilters
              dateFrom={filterForm.dateFrom}
              dateTo={filterForm.dateTo}
              center={filterForm.center}
              selectedKeywords={filterForm.keywords}
              keywordMatch={filterForm.keywordMatch}
              centers={facetCenters}
              keywords={facetKeywords}
              dateMin={facets.data?.date_min ?? null}
              dateMax={facets.data?.date_max ?? null}
              onDateChange={onDateChange}
              onCenterChange={onCenterChange}
              onKeywordChange={onKeywordChange}
              onKeywordMatchChange={onKeywordMatchChange}
              onClear={onClearFilters}
            />
          ) : (
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:border-gray-300"
              onClick={() => {
                onClearFilters();
                showBrowseAll();
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!historyOpen && (
          <Tooltip label="Open search history" side="right" className="flex h-full">
            <button
              type="button"
              className="flex h-full w-16 shrink-0 items-center justify-center border-r border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              aria-label="Open search history"
              aria-controls="search-history"
              aria-expanded={false}
              onClick={openHistoryPanel}
            >
              <HistoryIcon style={{ fontSize: 24 }} />
            </button>
          </Tooltip>
        )}
        {historyOpen && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/20 lg:hidden"
            aria-label="Close search history"
            onClick={closeHistory}
          />
        )}
        <aside
          id="search-history"
          ref={historyPanelRef}
          aria-hidden={!historyOpen}
          className={`absolute inset-y-0 left-0 z-30 flex w-80 max-w-[85vw] flex-col overflow-hidden bg-white shadow-lg transition-transform duration-200 ease-out lg:static lg:z-auto lg:max-w-none lg:shadow-none lg:transition-[width] ${
            historyOpen ? "translate-x-0 border-r lg:w-80" : "-translate-x-full lg:w-0 lg:translate-x-0"
          }`}
        >
          <div className="flex h-full w-80 max-w-[85vw] min-h-0 flex-col lg:w-80 lg:max-w-none">
            <SearchHistory
              activeSearchId={activeSearchId}
              onSelect={openHistory}
              onDeleted={handleHistoryDeleted}
              onClose={closeHistory}
            />
          </div>
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
              getKey={getCardKey}
              resetKey={showBrowse ? browseKey : activeSearchId}
              hasNextPage={activeRequest.hasNextPage}
              isFetchingNextPage={activeRequest.isFetchingNextPage}
              fetchNextPage={fetchCardsNext}
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
              renderItem={renderCard}
            />
          )}
        </main>
      </div>

      {selected && (
        <ImageDetail
          source={selected}
          onOpenSource={setSelected}
          onClose={closeDetail}
        />
      )}
    </div>
  );
};

export default Sources;
