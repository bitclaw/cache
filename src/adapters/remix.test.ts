import { describe, expect, test } from "bun:test";
import type { CacheConfig } from "../types";
import {
  createRemixCacheHeaders,
  getCacheHeadersForPath,
  getRemixCacheHeaders,
  shouldCacheRemixRequest,
  withCache,
} from "./remix";

const baseConfig: CacheConfig = {
  routes: [
    {
      pattern: "/blog",
      maxAge: 300,
      sMaxAge: 7200,
      staleWhileRevalidate: 86400,
    },
  ],
  enabled: true,
};

const blogRequest = new Request("https://example.com/blog/hello");
const apiRequest = new Request("https://example.com/api/users");

// ─── getRemixCacheHeaders ────────────────────────────────────────────

describe("getRemixCacheHeaders", () => {
  test("given matching route, when getting headers, then returns cache headers", () => {
    const headers = getRemixCacheHeaders(baseConfig, blogRequest);
    expect(headers.get("Cache-Control")).toContain("max-age=300");
    expect(headers.get("CDN-Cache-Control")).toContain("s-maxage=7200");
    expect(headers.get("Vary")).toBe("Accept-Encoding");
  });

  test("given non-matching route, when getting headers, then returns no-cache", () => {
    const headers = getRemixCacheHeaders(baseConfig, apiRequest);
    expect(headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(headers.get("CDN-Cache-Control")).toBeNull();
  });

  test("given authenticated context with excludeWhenAuthenticated, when getting headers, then returns no-cache", () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludeWhenAuthenticated: true,
    };
    const headers = getRemixCacheHeaders(config, blogRequest, {
      isAuthenticated: true,
    });
    expect(headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  test("given isProduction override, when getting headers, then uses override", () => {
    const config: CacheConfig = { ...baseConfig, enabled: undefined };
    const headers = getRemixCacheHeaders(config, blogRequest, {
      isProduction: true,
    });
    expect(headers.get("Cache-Control")).toContain("max-age=300");
  });

  test("given disabled config, when getting headers, then returns no-cache", () => {
    const config: CacheConfig = { ...baseConfig, enabled: false };
    const headers = getRemixCacheHeaders(config, blogRequest);
    expect(headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  test("given no context, when getting headers, then defaults to unauthenticated and non-production", () => {
    const config: CacheConfig = {
      routes: baseConfig.routes,
      enabled: true,
    };
    // Without context, isProduction defaults via process.env.NODE_ENV
    const headers = getRemixCacheHeaders(config, blogRequest);
    // In test environment, NODE_ENV is typically undefined or 'test'
    // so isProduction will be false, but enabled is true, so it caches
    expect(headers.get("Cache-Control")).toContain("max-age=300");
  });
});

// ─── createRemixCacheHeaders ─────────────────────────────────────────

describe("createRemixCacheHeaders", () => {
  test("given config, when creating headers function, then returns loader headers unchanged", () => {
    const headersFn = createRemixCacheHeaders(baseConfig);
    const loaderHeaders = new Headers({
      "Cache-Control": "public, max-age=300",
    });
    const result = headersFn({
      loaderHeaders,
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: undefined,
    }) as Headers;
    expect(result.get("Cache-Control")).toBe("public, max-age=300");
  });
});

// ─── getCacheHeadersForPath ──────────────────────────────────────────

describe("getCacheHeadersForPath", () => {
  test("given matching path, when getting headers, then returns cache headers", () => {
    const headers = getCacheHeadersForPath(baseConfig, "/blog/hello");
    expect(headers.get("Cache-Control")).toContain("max-age=300");
    expect(headers.get("Vary")).toBe("Accept-Encoding");
  });

  test("given non-matching path, when getting headers, then returns no-cache", () => {
    const headers = getCacheHeadersForPath(baseConfig, "/api/users");
    expect(headers.get("Cache-Control")).toBe("public, max-age=0");
    expect(headers.get("CDN-Cache-Control")).toBeNull();
  });
});

// ─── withCache ───────────────────────────────────────────────────────

describe("withCache", () => {
  test("given matching route loader, when wrapping, then adds cache headers", async () => {
    const loader = async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    const wrapped = withCache(baseConfig, loader);
    const response = await wrapped({
      request: blogRequest,
      params: {},
      context: {},
    });
    expect(response.headers.get("Cache-Control")).toContain("max-age=300");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  test("given loader that already sets Cache-Control, when wrapping, then does not override", async () => {
    const loader = async () =>
      new Response("ok", {
        headers: { "Cache-Control": "private, max-age=0" },
      });
    const wrapped = withCache(baseConfig, loader);
    const response = await wrapped({
      request: blogRequest,
      params: {},
      context: {},
    });
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0");
  });

  test("given non-matching route, when wrapping, then adds no-cache", async () => {
    const loader = async () => new Response("ok");
    const wrapped = withCache(baseConfig, loader);
    const response = await wrapped({
      request: apiRequest,
      params: {},
      context: {},
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  test("given disabled config, when wrapping, then adds no-cache", async () => {
    const config: CacheConfig = { ...baseConfig, enabled: false };
    const loader = async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    const wrapped = withCache(config, loader);
    const response = await wrapped({
      request: blogRequest,
      params: {},
      context: {},
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });
});

// ─── shouldCacheRemixRequest ─────────────────────────────────────────

describe("shouldCacheRemixRequest", () => {
  test("given matching route, when checking, then returns true", () => {
    expect(shouldCacheRemixRequest(baseConfig, blogRequest)).toBe(true);
  });

  test("given non-matching route, when checking, then returns false", () => {
    expect(shouldCacheRemixRequest(baseConfig, apiRequest)).toBe(false);
  });

  test("given authenticated context, when checking, then returns false", () => {
    const config: CacheConfig = {
      ...baseConfig,
      excludeWhenAuthenticated: true,
    };
    expect(
      shouldCacheRemixRequest(config, blogRequest, { isAuthenticated: true }),
    ).toBe(false);
  });

  test("given disabled config, when checking, then returns false", () => {
    const config: CacheConfig = { ...baseConfig, enabled: false };
    expect(shouldCacheRemixRequest(config, blogRequest)).toBe(false);
  });
});
