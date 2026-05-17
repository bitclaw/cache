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
export declare function getRemixCacheHeaders(config: CacheConfig, request: Request, context?: {
    isAuthenticated?: boolean;
    isProduction?: boolean;
}): Headers;
/**
 * Create a Remix headers function that applies cache headers
 *
 * @example
 * ```typescript
 * export const headers = createRemixCacheHeaders(cacheConfig)
 * ```
 */
export declare function createRemixCacheHeaders(_config: CacheConfig): HeadersFunction;
/**
 * Helper to get cache headers for a specific URL pathname
 * Useful when you know the pathname but don't have the full Request object
 *
 * @example
 * ```typescript
 * const headers = getCacheHeadersForPath(cacheConfig, '/blog')
 * ```
 */
export declare function getCacheHeadersForPath(config: CacheConfig, pathname: string): Headers;
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
export declare function withCache(config: CacheConfig, loader: (args: LoaderFunctionArgs) => Promise<Response> | Response): (args: LoaderFunctionArgs) => Promise<Response> | Response;
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
export declare function shouldCacheRemixRequest(config: CacheConfig, request: Request, context?: {
    isAuthenticated?: boolean;
    isProduction?: boolean;
}): boolean;
export {};
//# sourceMappingURL=remix.d.ts.map