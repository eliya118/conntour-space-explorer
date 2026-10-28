export interface Source {
  id: number;
  name: string;
  description: string;
  launch_date: string;
  image_url: string | null;
  type: string;
  status: string;
  keywords: string[];
  nasa_id: string | null;
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
  result_count: number;
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
