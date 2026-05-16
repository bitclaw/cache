import type { CacheRouteConfig } from './types';

/**
 * Preset cache configurations for common use cases
 */
export const CachePresets = {
  /**
   * Content caching (blog posts, docs, help pages)
   * - 5 min browser cache
   * - 2 hour CDN cache
   * - 24 hour stale-while-revalidate
   */
  content: {
    maxAge: 300, // 5 minutes
    sMaxAge: 7200, // 2 hours
    staleWhileRevalidate: 86400 // 24 hours
  },

  /**
   * Static assets (images, CSS, JS with hashed names)
   * - 1 year browser cache
   * - immutable
   */
  staticAssets: {
    maxAge: 31536000, // 1 year
    sMaxAge: 31536000, // 1 year
    staleWhileRevalidate: 0,
    customDirectives: ['immutable'] as string[]
  },

  /**
   * API responses (short-lived data)
   * - 30 sec browser cache
   * - 5 min CDN cache
   * - 1 hour stale-while-revalidate
   */
  api: {
    maxAge: 30, // 30 seconds
    sMaxAge: 300, // 5 minutes
    staleWhileRevalidate: 3600 // 1 hour
  },

  /**
   * Dynamic pages (homepage, dashboards)
   * - 1 min browser cache
   * - 5 min CDN cache
   * - 1 hour stale-while-revalidate
   */
  dynamic: {
    maxAge: 60, // 1 minute
    sMaxAge: 300, // 5 minutes
    staleWhileRevalidate: 3600 // 1 hour
  },

  /**
   * No cache (always fetch fresh)
   */
  noCache: {
    maxAge: 0,
    sMaxAge: 0,
    staleWhileRevalidate: 0,
    customDirectives: ['no-cache', 'no-store', 'must-revalidate'] as string[]
  }
} as const;

/**
 * Helper to create a cache route config with a preset
 */
export function createCacheRoute(
  pattern: string | RegExp,
  preset: keyof typeof CachePresets,
  overrides?: Partial<CacheRouteConfig>
): CacheRouteConfig {
  return {
    pattern,
    ...CachePresets[preset],
    ...overrides
  };
}

/**
 * Parse Cache-Control header value into an object
 */
export function parseCacheControl(
  header: string
): Record<string, string | true> {
  const result: Record<string, string | true> = {};

  for (const directive of header.split(',')) {
    const [key, value] = directive.trim().split('=');
    if (!key) continue;

    if (value) {
      result[key] = value;
    } else {
      result[key] = true;
    }
  }

  return result;
}

/**
 * Convert seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Get TTL (time-to-live) from Cache-Control header
 */
export function getTTL(cacheControl: string): number {
  const parsed = parseCacheControl(cacheControl);

  if (typeof parsed['s-maxage'] === 'string') {
    return parseInt(parsed['s-maxage'], 10);
  }

  if (typeof parsed['max-age'] === 'string') {
    return parseInt(parsed['max-age'], 10);
  }

  return 0;
}

/**
 * Merge multiple Cache-Control headers
 * Takes the most restrictive values
 */
export function mergeCacheControl(...headers: string[]): string {
  if (headers.length === 0) return 'no-cache';
  if (headers.length === 1) return headers[0]!;

  const parsed = headers.map(parseCacheControl);

  // If any header says no-cache, return no-cache
  if (parsed.some(p => p['no-cache'] || p['no-store'])) {
    return 'no-cache, no-store, must-revalidate';
  }

  // Find minimum max-age
  const maxAges = parsed
    .map(p =>
      typeof p['max-age'] === 'string' ? parseInt(p['max-age'], 10) : null
    )
    .filter((n): n is number => n !== null);

  const minMaxAge = maxAges.length > 0 ? Math.min(...maxAges) : 0;

  // Find minimum s-maxage
  const sMaxAges = parsed
    .map(p =>
      typeof p['s-maxage'] === 'string' ? parseInt(p['s-maxage'], 10) : null
    )
    .filter((n): n is number => n !== null);

  const minSMaxAge = sMaxAges.length > 0 ? Math.min(...sMaxAges) : undefined;

  // Build merged header
  const directives = ['public', `max-age=${minMaxAge}`];

  if (minSMaxAge !== undefined) {
    directives.push(`s-maxage=${minSMaxAge}`);
  }

  return directives.join(', ');
}
