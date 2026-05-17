import type { CacheRouteConfig } from './types';
/**
 * Preset cache configurations for common use cases
 */
export declare const CachePresets: {
    /**
     * Content caching (blog posts, docs, help pages)
     * - 5 min browser cache
     * - 2 hour CDN cache
     * - 24 hour stale-while-revalidate
     */
    readonly content: {
        readonly maxAge: 300;
        readonly sMaxAge: 7200;
        readonly staleWhileRevalidate: 86400;
    };
    /**
     * Static assets (images, CSS, JS with hashed names)
     * - 1 year browser cache
     * - immutable
     */
    readonly staticAssets: {
        readonly maxAge: 31536000;
        readonly sMaxAge: 31536000;
        readonly staleWhileRevalidate: 0;
        readonly customDirectives: string[];
    };
    /**
     * API responses (short-lived data)
     * - 30 sec browser cache
     * - 5 min CDN cache
     * - 1 hour stale-while-revalidate
     */
    readonly api: {
        readonly maxAge: 30;
        readonly sMaxAge: 300;
        readonly staleWhileRevalidate: 3600;
    };
    /**
     * Dynamic pages (homepage, dashboards)
     * - 1 min browser cache
     * - 5 min CDN cache
     * - 1 hour stale-while-revalidate
     */
    readonly dynamic: {
        readonly maxAge: 60;
        readonly sMaxAge: 300;
        readonly staleWhileRevalidate: 3600;
    };
    /**
     * No cache (always fetch fresh)
     */
    readonly noCache: {
        readonly maxAge: 0;
        readonly sMaxAge: 0;
        readonly staleWhileRevalidate: 0;
        readonly customDirectives: string[];
    };
};
/**
 * Helper to create a cache route config with a preset
 */
export declare function createCacheRoute(pattern: string | RegExp, preset: keyof typeof CachePresets, overrides?: Partial<CacheRouteConfig>): CacheRouteConfig;
/**
 * Parse Cache-Control header value into an object
 */
export declare function parseCacheControl(header: string): Record<string, string | true>;
/**
 * Convert seconds to human-readable duration
 */
export declare function formatDuration(seconds: number): string;
/**
 * Get TTL (time-to-live) from Cache-Control header
 */
export declare function getTTL(cacheControl: string): number;
/**
 * Merge multiple Cache-Control headers
 * Takes the most restrictive values
 */
export declare function mergeCacheControl(...headers: string[]): string;
//# sourceMappingURL=utils.d.ts.map