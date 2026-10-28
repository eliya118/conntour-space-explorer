export const queryKeys = {
  sources: ["sources"] as const,
  searches: ["searches"] as const,
  searchResults: (searchId: number | null) => ["search-results", searchId] as const,
  similar: (sourceId: number) => ["similar", sourceId] as const,
};
