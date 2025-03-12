/**
 * Interface for standardized API responses
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Interface for error responses
 */
export interface ErrorResponse {
  message: string;
  stack?: string;
}

/**
 * Interface for pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}