/**
 * Configuration for a single cache route pattern
 */
export type CacheRouteConfig = {
  /**
   * URL pattern to match (string for exact match, RegExp for pattern matching)
   * Examples:
   * - "/blog" - exact match
   * - /^\/blog/ - regex pattern
   */
  pattern: string | RegExp;

  /**
   * Browser cache time-to-live in seconds
   * Controls the "max-age" directive in Cache-Control header
   * @default 300 (5 minutes)
   */
  maxAge: number;

  /**
   * CDN/shared cache time-to-live in seconds
   * Controls the "s-maxage" directive in Cache-Control header
   * @default 3600 (1 hour)
   */
  sMaxAge: number;

  /**
   * Stale-while-revalidate time in seconds
   * Allows serving stale content while fetching fresh content in background
   * @default 86400 (24 hours)
   */
  staleWhileRevalidate: number;

  /**
   * Optional: Custom Cache-Control directives
   * Will be appended to the generated header
   */
  customDirectives?: string[];
};

/**
 * Main cache configuration
 */
export type CacheConfig = {
  /**
   * Array of route patterns with their cache settings
   */
  routes: CacheRouteConfig[];

  /**
   * Default max-age for routes not matching any pattern
   * @default 0 (no cache)
   */
  defaultMaxAge?: number;

  /**
   * Enable or disable caching globally
   * Useful for development environments
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to exclude caching for authenticated users
   * @default true
   */
  excludeWhenAuthenticated?: boolean;

  /**
   * Additional conditions to exclude from caching
   */
  excludePatterns?: Array<string | RegExp>;
};

/**
 * Context for cache decision-making
 */
export type CacheContext = {
  /**
   * The URL being requested
   */
  url: string;

  /**
   * HTTP method (GET, POST, etc.)
   */
  method: string;

  /**
   * Whether the user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Whether running in production
   */
  isProduction: boolean;

  /**
   * Optional: Custom context data
   */
  [key: string]: unknown;
};

/**
 * Result of cache evaluation
 */
export type CacheResult = {
  /**
   * Whether to cache this request
   */
  shouldCache: boolean;

  /**
   * Cache-Control header value
   */
  cacheControl?: string;

  /**
   * CDN-Cache-Control header value (Cloudflare-specific)
   */
  cdnCacheControl?: string;

  /**
   * Reason for caching decision (for debugging)
   */
  reason?: string;
};
