import type {
  CacheConfig,
  CacheContext,
  CacheResult,
  CacheRouteConfig
} from './types';

/**
 * Check if a URL matches a pattern
 */
function matchesPattern(url: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return url === pattern || url.startsWith(pattern);
  }
  return pattern.test(url);
}

/**
 * Find the cache route config that matches the given URL
 */
function findMatchingRoute(
  url: string,
  routes: CacheRouteConfig[]
): CacheRouteConfig | undefined {
  return routes.find(route => matchesPattern(url, route.pattern));
}

/**
 * Check if the URL should be excluded from caching
 */
function isExcluded(
  url: string,
  excludePatterns?: Array<string | RegExp>
): boolean {
  if (!excludePatterns || excludePatterns.length === 0) {
    return false;
  }
  return excludePatterns.some(pattern => matchesPattern(url, pattern));
}

/**
 * Determine if a request should be cached based on context
 */
export function shouldCache(
  config: CacheConfig,
  context: CacheContext
): boolean {
  // Check if caching is globally enabled
  if (config.enabled === false) {
    return false;
  }

  // Only cache in production (unless explicitly overridden)
  if (!context.isProduction && config.enabled !== true) {
    return false;
  }

  // Only cache GET requests
  if (context.method !== 'GET') {
    return false;
  }

  // Check if authenticated users should be excluded
  if (config.excludeWhenAuthenticated && context.isAuthenticated) {
    return false;
  }

  // Check if URL is in exclude list
  if (isExcluded(context.url, config.excludePatterns)) {
    return false;
  }

  // Check if URL matches any cache route
  const matchingRoute = findMatchingRoute(context.url, config.routes);
  return matchingRoute !== undefined;
}

/**
 * Generate Cache-Control header value
 */
function buildCacheControlHeader(route: CacheRouteConfig): string {
  const directives: string[] = ['public'];

  // Add max-age (browser cache)
  directives.push(`max-age=${route.maxAge}`);

  // Add s-maxage (CDN cache)
  directives.push(`s-maxage=${route.sMaxAge}`);

  // Add stale-while-revalidate
  if (route.staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${route.staleWhileRevalidate}`);
  }

  // Add custom directives
  if (route.customDirectives && route.customDirectives.length > 0) {
    directives.push(...route.customDirectives);
  }

  return directives.join(', ');
}

/**
 * Generate CDN-Cache-Control header value (Cloudflare-specific)
 */
function buildCdnCacheControlHeader(route: CacheRouteConfig): string {
  const directives: string[] = ['public'];

  // CDN-specific settings
  directives.push(`s-maxage=${route.sMaxAge}`);

  if (route.staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${route.staleWhileRevalidate}`);
  }

  return directives.join(', ');
}

/**
 * Get cache headers for a given URL
 */
export function getCacheHeaders(
  config: CacheConfig,
  url: string
): Record<string, string> {
  // Find matching route
  const matchingRoute = findMatchingRoute(url, config.routes);

  if (!matchingRoute) {
    // Return default no-cache headers
    return {
      'Cache-Control': `public, max-age=${config.defaultMaxAge ?? 0}`
    };
  }

  // Build cache headers
  return {
    'Cache-Control': buildCacheControlHeader(matchingRoute),
    'CDN-Cache-Control': buildCdnCacheControlHeader(matchingRoute),
    Vary: 'Accept-Encoding'
  };
}

/**
 * Evaluate caching for a request and return detailed result
 */
export function evaluateCache(
  config: CacheConfig,
  context: CacheContext
): CacheResult {
  // Check basic caching eligibility
  if (config.enabled === false) {
    return {
      shouldCache: false,
      reason: 'Caching is globally disabled'
    };
  }

  if (!context.isProduction && config.enabled !== true) {
    return {
      shouldCache: false,
      reason: 'Not in production environment'
    };
  }

  if (context.method !== 'GET') {
    return {
      shouldCache: false,
      reason: `Non-GET method: ${context.method}`
    };
  }

  if (config.excludeWhenAuthenticated && context.isAuthenticated) {
    return {
      shouldCache: false,
      reason: 'User is authenticated'
    };
  }

  if (isExcluded(context.url, config.excludePatterns)) {
    return {
      shouldCache: false,
      reason: 'URL matches exclude pattern'
    };
  }

  // Find matching route
  const matchingRoute = findMatchingRoute(context.url, config.routes);

  if (!matchingRoute) {
    return {
      shouldCache: false,
      reason: 'No matching cache route'
    };
  }

  // Build headers
  const cacheControl = buildCacheControlHeader(matchingRoute);
  const cdnCacheControl = buildCdnCacheControlHeader(matchingRoute);

  return {
    shouldCache: true,
    cacheControl,
    cdnCacheControl,
    reason: 'Matched cache route'
  };
}
