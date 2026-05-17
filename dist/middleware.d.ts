import type { CacheConfig, CacheContext, CacheResult } from './types';
/**
 * Determine if a request should be cached based on context
 */
export declare function shouldCache(config: CacheConfig, context: CacheContext): boolean;
/**
 * Get cache headers for a given URL
 */
export declare function getCacheHeaders(config: CacheConfig, url: string): Record<string, string>;
/**
 * Evaluate caching for a request and return detailed result
 */
export declare function evaluateCache(config: CacheConfig, context: CacheContext): CacheResult;
//# sourceMappingURL=middleware.d.ts.map