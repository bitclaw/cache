import { describe, expect, test } from 'bun:test';
import { evaluateCache, getCacheHeaders, shouldCache } from './middleware';
import type { CacheConfig, CacheContext } from './types';
import { createCacheRoute } from './utils';

// ─── Fixtures ────────────────────────────────────────────────────────

const productionGet: CacheContext = {
  url: '/blog/hello',
  method: 'GET',
  isAuthenticated: false,
  isProduction: true
};

const blogRoute = createCacheRoute('/blog', 'content');

const baseConfig: CacheConfig = {
  routes: [blogRoute],
  enabled: true,
  excludeWhenAuthenticated: true
};

// ─── shouldCache ─────────────────────────────────────────────────────

describe('shouldCache', () => {
  test('given disabled config, when checking, then returns false', () => {
    const config: CacheConfig = { ...baseConfig, enabled: false };
    expect(shouldCache(config, productionGet)).toBe(false);
  });

  test('given non-production context without explicit enable, when checking, then returns false', () => {
    const config: CacheConfig = { ...baseConfig, enabled: undefined };
    const ctx: CacheContext = { ...productionGet, isProduction: false };
    expect(shouldCache(config, ctx)).toBe(false);
  });

  test('given non-production context with explicit enable, when checking, then returns true', () => {
    const config: CacheConfig = { ...baseConfig, enabled: true };
    const ctx: CacheContext = { ...productionGet, isProduction: false };
    expect(shouldCache(config, ctx)).toBe(true);
  });

  test('given POST method, when checking, then returns false', () => {
    const ctx: CacheContext = { ...productionGet, method: 'POST' };
    expect(shouldCache(baseConfig, ctx)).toBe(false);
  });

  test('given authenticated user with excludeWhenAuthenticated, when checking, then returns false', () => {
    const ctx: CacheContext = { ...productionGet, isAuthenticated: true };
    expect(shouldCache(baseConfig, ctx)).toBe(false);
  });

  test('given excluded URL, when checking, then returns false', () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludePatterns: ['/blog/draft']
    };
    const ctx: CacheContext = { ...productionGet, url: '/blog/draft-post' };
    expect(shouldCache(config, ctx)).toBe(false);
  });

  test('given non-matching URL, when checking, then returns false', () => {
    const ctx: CacheContext = { ...productionGet, url: '/dashboard' };
    expect(shouldCache(baseConfig, ctx)).toBe(false);
  });

  test('given matching route in production, when checking, then returns true', () => {
    expect(shouldCache(baseConfig, productionGet)).toBe(true);
  });

  test('given authenticated user with excludeWhenAuthenticated false, when checking, then returns true', () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludeWhenAuthenticated: false
    };
    const ctx: CacheContext = { ...productionGet, isAuthenticated: true };
    expect(shouldCache(config, ctx)).toBe(true);
  });

  test('given empty routes, when checking, then returns false', () => {
    const config: CacheConfig = { ...baseConfig, routes: [] };
    expect(shouldCache(config, productionGet)).toBe(false);
  });

  test('given regex exclude pattern, when checking, then returns false', () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludePatterns: [/^\/blog\/draft/]
    };
    const ctx: CacheContext = { ...productionGet, url: '/blog/draft-post' };
    expect(shouldCache(config, ctx)).toBe(false);
  });

  test('given PUT method, when checking, then returns false', () => {
    const ctx: CacheContext = { ...productionGet, method: 'PUT' };
    expect(shouldCache(baseConfig, ctx)).toBe(false);
  });
});

// ─── getCacheHeaders ─────────────────────────────────────────────────

describe('getCacheHeaders', () => {
  test('given non-matching URL, when getting headers, then returns default no-cache', () => {
    const headers = getCacheHeaders(baseConfig, '/dashboard');
    expect(headers['Cache-Control']).toBe('public, max-age=0');
    expect(headers['CDN-Cache-Control']).toBeUndefined();
  });

  test('given non-matching URL with custom defaultMaxAge, when getting headers, then uses default', () => {
    const config: CacheConfig = { ...baseConfig, defaultMaxAge: 60 };
    const headers = getCacheHeaders(config, '/dashboard');
    expect(headers['Cache-Control']).toBe('public, max-age=60');
  });

  test('given matching route, when getting headers, then returns Cache-Control + CDN-Cache-Control + Vary', () => {
    const headers = getCacheHeaders(baseConfig, '/blog/hello');
    expect(headers['Cache-Control']).toContain('max-age=300');
    expect(headers['Cache-Control']).toContain('s-maxage=7200');
    expect(headers['CDN-Cache-Control']).toContain('s-maxage=7200');
    expect(headers.Vary).toBe('Accept-Encoding');
  });

  test('given route with custom directives, when getting headers, then includes them', () => {
    const config: CacheConfig = {
      routes: [createCacheRoute('/assets', 'staticAssets')],
      enabled: true
    };
    const headers = getCacheHeaders(config, '/assets/style.css');
    expect(headers['Cache-Control']).toContain('immutable');
  });

  test('given route with staleWhileRevalidate, when getting headers, then includes swr directive', () => {
    const headers = getCacheHeaders(baseConfig, '/blog/hello');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
    expect(headers['CDN-Cache-Control']).toContain(
      'stale-while-revalidate=86400'
    );
  });

  test('given no routes configured, when getting headers, then returns default no-cache', () => {
    const config: CacheConfig = { routes: [], enabled: true };
    const headers = getCacheHeaders(config, '/blog/hello');
    expect(headers['Cache-Control']).toBe('public, max-age=0');
    expect(headers['CDN-Cache-Control']).toBeUndefined();
  });

  test('given route with zero staleWhileRevalidate, when getting headers, then omits swr directive', () => {
    const config: CacheConfig = {
      routes: [
        {
          pattern: '/fast',
          maxAge: 10,
          sMaxAge: 10,
          staleWhileRevalidate: 0
        }
      ],
      enabled: true
    };
    const headers = getCacheHeaders(config, '/fast');
    expect(headers['Cache-Control']).not.toContain('stale-while-revalidate');
    expect(headers['CDN-Cache-Control']).not.toContain(
      'stale-while-revalidate'
    );
  });

  test('given route with regex pattern, when getting headers, then matches correctly', () => {
    const config: CacheConfig = {
      routes: [
        {
          pattern: /^\/api/,
          maxAge: 30,
          sMaxAge: 60,
          staleWhileRevalidate: 0
        }
      ],
      enabled: true
    };
    const headers = getCacheHeaders(config, '/api/users');
    expect(headers['Cache-Control']).toContain('max-age=30');
  });

  test('given URL with query params, when getting headers, then matches pathname only', () => {
    const headers = getCacheHeaders(baseConfig, '/blog/post?ref=home');
    expect(headers['Cache-Control']).toContain('max-age=300');
  });

  test('given route with exact string match, when getting headers, then matches', () => {
    const config: CacheConfig = {
      routes: [
        {
          pattern: '/exact',
          maxAge: 60,
          sMaxAge: 60,
          staleWhileRevalidate: 0
        }
      ],
      enabled: true
    };
    const headers = getCacheHeaders(config, '/exact');
    expect(headers['Cache-Control']).toContain('max-age=60');
  });
});

// ─── evaluateCache ───────────────────────────────────────────────────

describe('evaluateCache', () => {
  test('given disabled config, when evaluating, then returns reason "globally disabled"', () => {
    const config: CacheConfig = { ...baseConfig, enabled: false };
    const result = evaluateCache(config, productionGet);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('Caching is globally disabled');
  });

  test('given non-production without explicit enable, when evaluating, then returns reason "not in production"', () => {
    const config: CacheConfig = { ...baseConfig, enabled: undefined };
    const ctx: CacheContext = { ...productionGet, isProduction: false };
    const result = evaluateCache(config, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('Not in production environment');
  });

  test('given POST method, when evaluating, then returns reason with method name', () => {
    const ctx: CacheContext = { ...productionGet, method: 'POST' };
    const result = evaluateCache(baseConfig, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('Non-GET method: POST');
  });

  test('given authenticated user, when evaluating, then returns reason "authenticated"', () => {
    const ctx: CacheContext = { ...productionGet, isAuthenticated: true };
    const result = evaluateCache(baseConfig, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('User is authenticated');
  });

  test('given excluded URL, when evaluating, then returns reason "exclude pattern"', () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludePatterns: ['/blog/draft']
    };
    const ctx: CacheContext = { ...productionGet, url: '/blog/draft-post' };
    const result = evaluateCache(config, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('URL matches exclude pattern');
  });

  test('given non-matching URL, when evaluating, then returns reason "no matching route"', () => {
    const ctx: CacheContext = { ...productionGet, url: '/unknown' };
    const result = evaluateCache(baseConfig, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('No matching cache route');
  });

  test('given matching route, when evaluating, then returns shouldCache true with headers', () => {
    const result = evaluateCache(baseConfig, productionGet);
    expect(result.shouldCache).toBe(true);
    expect(result.cacheControl).toContain('max-age=300');
    expect(result.cdnCacheControl).toContain('s-maxage=7200');
    expect(result.reason).toBe('Matched cache route');
  });

  test('given regex route pattern, when evaluating, then matches correctly', () => {
    const config: CacheConfig = {
      routes: [
        {
          pattern: /^\/api\/v\d+/,
          maxAge: 30,
          sMaxAge: 60,
          staleWhileRevalidate: 0
        }
      ],
      enabled: true
    };
    const ctx: CacheContext = { ...productionGet, url: '/api/v2/users' };
    const result = evaluateCache(config, ctx);
    expect(result.shouldCache).toBe(true);
  });

  test('given regex exclude pattern, when evaluating, then returns "exclude pattern"', () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludePatterns: [/^\/blog\/draft/]
    };
    const ctx: CacheContext = { ...productionGet, url: '/blog/draft-post' };
    const result = evaluateCache(config, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('URL matches exclude pattern');
  });

  test('given regex route that does not match, when evaluating, then returns "no matching route"', () => {
    const config: CacheConfig = {
      routes: [
        {
          pattern: /^\/api/,
          maxAge: 30,
          sMaxAge: 60,
          staleWhileRevalidate: 0
        }
      ],
      enabled: true
    };
    const ctx: CacheContext = { ...productionGet, url: '/blog/hello' };
    const result = evaluateCache(config, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('No matching cache route');
  });

  test('given excludeWhenAuthenticated false and auth user, when evaluating, then caches', () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludeWhenAuthenticated: false
    };
    const ctx: CacheContext = { ...productionGet, isAuthenticated: true };
    const result = evaluateCache(config, ctx);
    expect(result.shouldCache).toBe(true);
    expect(result.reason).toBe('Matched cache route');
  });

  test('given PUT method, when evaluating, then returns reason with method name', () => {
    const ctx: CacheContext = { ...productionGet, method: 'PUT' };
    const result = evaluateCache(baseConfig, ctx);
    expect(result.shouldCache).toBe(false);
    expect(result.reason).toBe('Non-GET method: PUT');
  });

  test('given regex pattern that should not match, when evaluating, then returns false', () => {
    const config: CacheConfig = {
      routes: [
        {
          pattern: /^\/api/,
          maxAge: 30,
          sMaxAge: 60,
          staleWhileRevalidate: 0
        }
      ],
      enabled: true
    };
    const ctx: CacheContext = { ...productionGet, url: '/blog/hello' };
    expect(evaluateCache(config, ctx).shouldCache).toBe(false);
  });
});
