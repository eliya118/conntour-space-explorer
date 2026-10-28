import { SourceQueryFilters } from "../types";

export const queryKeys = {
  sources: (filters: SourceQueryFilters) => ["sources", filters] as const,
  sourceFacets: ["source-facets"] as const,
  searches: ["searches"] as const,
  searchResults: (searchId: number | null) => ["search-results", searchId] as const,
  similar: (sourceId: number) => ["similar", sourceId] as const,
};
