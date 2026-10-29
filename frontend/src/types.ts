export interface Source {
  id: number;
  name: string;
  description: string;
  launch_date: string;
  center: string;
  image_url: string | null;
  type: string;
  status: string;
  keywords: string[];
  nasa_id: string | null;
}

export type KeywordMatch = "and" | "or";

export interface SourceQueryFilters {
  dateFrom?: string;
  dateTo?: string;
  center?: string;
  keywords?: string[];
  keywordMatch?: KeywordMatch;
}

export interface SourceFacets {
  centers: string[];
  keywords: string[];
  date_min: string | null;
  date_max: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ScoredSource {
  source: Source;
  confidence: number;
}

export interface SearchSummary {
  id: number;
  query: string;
  created_at: string;
}

export interface SearchResults {
  id: number;
  query: string;
  created_at: string;
  items: ScoredSource[];
  total: number;
  limit: number;
  offset: number;
}
