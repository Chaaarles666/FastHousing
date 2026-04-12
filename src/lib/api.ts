const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

type QueryValue = string | number | boolean | undefined | null;

async function fetchAPI<T>(path: string, params?: Record<string, QueryValue>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export interface CommunitySummary {
  id: number;
  name: string;
  district?: string;
  sub_district?: string;
  avg_unit_price?: number;
  listing_count?: number;
  build_year?: number;
}

export interface PriceHistoryPoint {
  date: string;
  avg_unit_price: number;
  listing_count?: number;
  deal_count?: number;
}

export interface ListingItem {
  id: number;
  title?: string;
  total_price?: number;
  unit_price?: number;
  area?: number;
  layout?: string;
  floor_info?: string;
  orientation?: string;
  decoration?: string;
  build_year?: number;
  community_name?: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ListingQuery extends Record<string, QueryValue> {
  community_id?: number;
  min_price?: number;
  max_price?: number;
  min_area?: number;
  max_area?: number;
  rooms?: number;
  status?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export function searchCommunities(q: string) {
  return fetchAPI<CommunitySummary[]>("/communities/search", { q });
}

export function getCommunity(id: number) {
  return fetchAPI<CommunitySummary>(`/communities/${id}`);
}

export function getCommunityPriceHistory(id: number, months = 12) {
  return fetchAPI<PriceHistoryPoint[]>(`/communities/${id}/price-history`, { months });
}

export function getListings(params: ListingQuery) {
  return fetchAPI<PagedResponse<ListingItem>>("/listings", params);
}

export function getTransactions(community_id: number, months = 6, page = 1, size = 20) {
  return fetchAPI<unknown>("/transactions", { community_id, months, page, size });
}

export function getTransactionStats(community_id: number, months = 12) {
  return fetchAPI<unknown>("/transactions/stats", { community_id, months });
}

export function checkPrice(community_id: number, total_price: number, area: number) {
  return fetchAPI<unknown>("/analysis/price-check", { community_id, total_price, area });
}
