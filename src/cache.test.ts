import { describe, expect, test } from 'bun:test';
import { evaluateCache, getCacheHeaders, shouldCache } from './middleware';
import type { CacheConfig, CacheContext } from './types';
import {
  CachePresets,
  createCacheRoute,
  formatDuration,
  getTTL,
  mergeCacheControl,
  parseCacheControl
} from './utils';

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
});

// ─── parseCacheControl ───────────────────────────────────────────────

describe('parseCacheControl', () => {
  test('given key=value directives, when parsing, then returns values as strings', () => {
    const result = parseCacheControl('public, max-age=300, s-maxage=7200');
    expect(result['max-age']).toBe('300');
    expect(result['s-maxage']).toBe('7200');
    expect(result.public).toBe(true);
  });

  test('given boolean directives, when parsing, then returns true', () => {
    const result = parseCacheControl('no-cache, no-store, must-revalidate');
    expect(result['no-cache']).toBe(true);
    expect(result['no-store']).toBe(true);
    expect(result['must-revalidate']).toBe(true);
  });

  test('given empty string, when parsing, then returns empty object', () => {
    const result = parseCacheControl('');
    expect(Object.keys(result).length).toBe(0);
  });
});

// ─── formatDuration ──────────────────────────────────────────────────

describe('formatDuration', () => {
  test('given 0 seconds, when formatting, then returns "0s"', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  test('given seconds under 60, when formatting, then returns seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  test('given minutes, when formatting, then returns minutes', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  test('given hours, when formatting, then returns hours', () => {
    expect(formatDuration(7200)).toBe('2h');
  });

  test('given days, when formatting, then returns days', () => {
    expect(formatDuration(172800)).toBe('2d');
  });
});

// ─── getTTL ──────────────────────────────────────────────────────────

describe('getTTL', () => {
  test('given s-maxage and max-age, when getting TTL, then prefers s-maxage', () => {
    expect(getTTL('public, max-age=60, s-maxage=3600')).toBe(3600);
  });

  test('given only max-age, when getting TTL, then falls back to max-age', () => {
    expect(getTTL('public, max-age=120')).toBe(120);
  });

  test('given no age directives, when getting TTL, then returns 0', () => {
    expect(getTTL('no-cache')).toBe(0);
  });
});

// ─── mergeCacheControl ───────────────────────────────────────────────

describe('mergeCacheControl', () => {
  test('given no-cache in any header, when merging, then returns no-cache', () => {
    const result = mergeCacheControl(
      'public, max-age=300',
      'no-cache, no-store'
    );
    expect(result).toBe('no-cache, no-store, must-revalidate');
  });

  test('given multiple headers, when merging, then takes minimum values', () => {
    const result = mergeCacheControl(
      'public, max-age=300, s-maxage=7200',
      'public, max-age=60, s-maxage=600'
    );
    expect(result).toContain('max-age=60');
    expect(result).toContain('s-maxage=600');
  });

  test('given single header, when merging, then returns it unchanged', () => {
    const header = 'public, max-age=300';
    expect(mergeCacheControl(header)).toBe(header);
  });

  test('given empty headers array, when merging, then returns no-cache', () => {
    expect(mergeCacheControl()).toBe('no-cache');
  });
});

// ─── createCacheRoute ────────────────────────────────────────────────

describe('createCacheRoute', () => {
  test('given preset name, when creating route, then applies preset values', () => {
    const route = createCacheRoute('/api', 'api');
    expect(route.pattern).toBe('/api');
    expect(route.maxAge).toBe(30);
    expect(route.sMaxAge).toBe(300);
    expect(route.staleWhileRevalidate).toBe(3600);
  });

  test('given overrides, when creating route, then overrides preset values', () => {
    const route = createCacheRoute('/api', 'api', { maxAge: 10 });
    expect(route.maxAge).toBe(10);
    expect(route.sMaxAge).toBe(300); // unchanged from preset
  });
});

// ─── CachePresets ────────────────────────────────────────────────────

describe('CachePresets', () => {
  test('all presets have required fields', () => {
    for (const [_name, preset] of Object.entries(CachePresets)) {
      expect(typeof preset.maxAge).toBe('number');
      expect(typeof preset.sMaxAge).toBe('number');
      expect(typeof preset.staleWhileRevalidate).toBe('number');
    }
  });
});
