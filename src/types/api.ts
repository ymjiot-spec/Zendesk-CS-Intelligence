/**
 * API-related type definitions
 * Common types for REST API requests and responses
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    lastUpdatedAt: string; // データ最終更新日時
    populationInfo: {
      totalCount: number;
      excludedCount: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface DateRangeQuery {
  startDate: string; // ISO 8601 (YYYY-MM-DD)
  endDate: string; // ISO 8601 (YYYY-MM-DD)
}

// クイック選択プリセット (要件6)
export type QuickSelect =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
