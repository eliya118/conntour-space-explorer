import axios from "axios";

import { Page, ScoredSource, SearchResults, SearchSummary, Source } from "../types";

export const PAGE_SIZE = 24;

export function nextOffset(page: { offset: number; items: unknown[]; total: number }): number | undefined {
  const next = page.offset + page.items.length;
  return next < page.total ? next : undefined;
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }
  return "Something went wrong. Try again.";
}

export async function fetchSources(offset: number): Promise<Page<Source>> {
  const response = await axios.get<Page<Source>>("/api/sources", {
    params: { limit: PAGE_SIZE, offset },
  });
  return response.data;
}

export async function fetchSimilar(sourceId: number, offset: number): Promise<Page<ScoredSource>> {
  const response = await axios.get<Page<ScoredSource>>(`/api/sources/${sourceId}/similar`, {
    params: { limit: PAGE_SIZE, offset },
  });
  return response.data;
}

export async function createSearch(query: string): Promise<SearchResults> {
  const response = await axios.post<SearchResults>(
    "/api/searches",
    { query },
    { params: { limit: PAGE_SIZE, offset: 0 } }
  );
  return response.data;
}

export async function fetchSearches(offset: number): Promise<Page<SearchSummary>> {
  const response = await axios.get<Page<SearchSummary>>("/api/searches", {
    params: { limit: PAGE_SIZE, offset },
  });
  return response.data;
}

export async function fetchSearch(searchId: number, offset: number): Promise<SearchResults> {
  const response = await axios.get<SearchResults>(`/api/searches/${searchId}`, {
    params: { limit: PAGE_SIZE, offset },
  });
  return response.data;
}

export async function deleteSearch(searchId: number): Promise<void> {
  await axios.delete(`/api/searches/${searchId}`);
}
