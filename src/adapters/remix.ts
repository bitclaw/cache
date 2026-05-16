import { evaluateCache, getCacheHeaders } from '../middleware';
import type { CacheConfig } from '../types';

/**
 * Remix-specific types (imported from @remix-run/node if available)
 */
type LoaderFunctionArgs = {
  request: Request;
  params: Record<string, string | undefined>;
  context: unknown;
};

type HeadersFunction = (args: {
  loaderHeaders: Headers;
  parentHeaders: Headers;
  actionHeaders: Headers;
  errorHeaders: Headers | undefined;
}) => Headers | HeadersInit;

/**
 * Get cache headers for a Remix loader
 *
 * @example
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const data = await fetchData()
 *   const headers = getRemixCacheHeaders(cacheConfig, request)
 *   return json(data, { headers })
 * }
 * ```
 */
export function getRemixCacheHeaders(
  config: CacheConfig,
  request: Request,
  context?: {
    isAuthenticated?: boolean;
    isProduction?: boolean;
  }
): Headers {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Determine authentication status
  // In Remix, you'd typically check session/cookie here
  const isAuthenticated = context?.isAuthenticated ?? false;

  // Determine environment
  const isProduction =
    context?.isProduction ?? process.env.NODE_ENV === 'production';

  // Evaluate cache
  const result = evaluateCache(config, {
    url: pathname,
    method: request.method,
    isAuthenticated,
    isProduction
  });

  const headers = new Headers();

  if (result.shouldCache && result.cacheControl) {
    headers.set('Cache-Control', result.cacheControl);

    if (result.cdnCacheControl) {
      headers.set('CDN-Cache-Control', result.cdnCacheControl);
    }

    headers.set('Vary', 'Accept-Encoding');
  } else {
    // No cache
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return headers;
}

/**
 * Create a Remix headers function that applies cache headers
 *
 * @example
 * ```typescript
 * export const headers = createRemixCacheHeaders(cacheConfig)
 * ```
 */
export function createRemixCacheHeaders(_config: CacheConfig): HeadersFunction {
  return ({ loaderHeaders }) => {
    // Return loader headers (which should have cache headers from loader)
    return loaderHeaders;
  };
}

/**
 * Helper to get cache headers for a specific URL pathname
 * Useful when you know the pathname but don't have the full Request object
 *
 * @example
 * ```typescript
 * const headers = getCacheHeadersForPath(cacheConfig, '/blog')
 * ```
 */
export function getCacheHeadersForPath(
  config: CacheConfig,
  pathname: string
): Headers {
  const headerObj = getCacheHeaders(config, pathname);
  const headers = new Headers();

  for (const [key, value] of Object.entries(headerObj)) {
    headers.set(key, value);
  }

  return headers;
}

/**
 * Middleware-style cache wrapper for Remix loaders
 * Automatically applies cache headers based on configuration
 *
 * @example
 * ```typescript
 * export const loader = withCache(cacheConfig, async ({ request }: LoaderFunctionArgs) => {
 *   const data = await fetchData()
 *   return json(data)
 * })
 * ```
 */
export function withCache(
  config: CacheConfig,
  loader: (args: LoaderFunctionArgs) => Promise<Response> | Response
): (args: LoaderFunctionArgs) => Promise<Response> | Response {
  return async (args: LoaderFunctionArgs) => {
    const response = await loader(args);

    // Get cache headers
    const cacheHeaders = getRemixCacheHeaders(config, args.request);

    // Merge with existing headers
    const headers = new Headers(response.headers);
    for (const [key, value] of cacheHeaders) {
      // Only set if not already set by loader
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }

    // Return new response with cache headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}

/**
 * Check if a request should be cached (Remix-specific)
 *
 * @example
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   if (shouldCacheRemixRequest(cacheConfig, request)) {
 *     // Use cached version
 *   }
 * }
 * ```
 */
export function shouldCacheRemixRequest(
  config: CacheConfig,
  request: Request,
  context?: {
    isAuthenticated?: boolean;
    isProduction?: boolean;
  }
): boolean {
  const url = new URL(request.url);
  const isAuthenticated = context?.isAuthenticated ?? false;
  const isProduction =
    context?.isProduction ?? process.env.NODE_ENV === 'production';

  const result = evaluateCache(config, {
    url: url.pathname,
    method: request.method,
    isAuthenticated,
    isProduction
  });

  return result.shouldCache;
}
