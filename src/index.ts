/**
 * @bitclaw/cache
 *
 * Framework-agnostic caching middleware for edge CDNs
 */

// Core middleware functions
export { evaluateCache, getCacheHeaders, shouldCache } from './middleware';
// Core types
export type {
  CacheConfig,
  CacheContext,
  CacheResult,
  CacheRouteConfig
} from './types';
// Utilities
export {
  CachePresets,
  createCacheRoute,
  formatDuration,
  getTTL,
  mergeCacheControl,
  parseCacheControl
} from './utils';
