import { describe, expect, test } from "bun:test";
import {
  CachePresets,
  createCacheRoute,
  formatDuration,
  getTTL,
  mergeCacheControl,
  parseCacheControl,
} from "./utils";

// ─── parseCacheControl ───────────────────────────────────────────────

describe("parseCacheControl", () => {
  test("given key=value directives, when parsing, then returns values as strings", () => {
    const result = parseCacheControl("public, max-age=300, s-maxage=7200");
    expect(result["max-age"]).toBe("300");
    expect(result["s-maxage"]).toBe("7200");
    expect(result.public).toBe(true);
  });

  test("given boolean directives, when parsing, then returns true", () => {
    const result = parseCacheControl("no-cache, no-store, must-revalidate");
    expect(result["no-cache"]).toBe(true);
    expect(result["no-store"]).toBe(true);
    expect(result["must-revalidate"]).toBe(true);
  });

  test("given empty string, when parsing, then returns empty object", () => {
    const result = parseCacheControl("");
    expect(Object.keys(result).length).toBe(0);
  });

  test("given whitespace around directives, when parsing, then trims correctly", () => {
    const result = parseCacheControl(" public , max-age=300 , s-maxage=7200 ");
    expect(result["max-age"]).toBe("300");
    expect(result["s-maxage"]).toBe("7200");
    expect(result.public).toBe(true);
  });

  test("given key with trailing equals but no value, when parsing, then returns true", () => {
    const result = parseCacheControl("no-cache=");
    expect(result["no-cache"]).toBe(true);
  });

  test("given entry with no key but has value, when parsing, then ignores it", () => {
    const result = parseCacheControl("=300, max-age=60");
    expect(result["max-age"]).toBe("60");
    expect(Object.keys(result).length).toBe(1);
  });

  test("given trailing comma, when parsing, then ignores trailing empty entry", () => {
    const result = parseCacheControl("max-age=300,");
    expect(result["max-age"]).toBe("300");
  });

  test("given duplicate keys, when parsing, then last value wins", () => {
    const result = parseCacheControl("max-age=100, max-age=200");
    expect(result["max-age"]).toBe("200");
  });
});

// ─── formatDuration ──────────────────────────────────────────────────

describe("formatDuration", () => {
  test('given 0 seconds, when formatting, then returns "0s"', () => {
    expect(formatDuration(0)).toBe("0s");
  });

  test("given seconds under 60, when formatting, then returns seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  test("given boundary at 59 seconds, when formatting, then returns seconds", () => {
    expect(formatDuration(59)).toBe("59s");
  });

  test("given boundary at 60 seconds (1 minute), when formatting, then returns 1m", () => {
    expect(formatDuration(60)).toBe("1m");
  });

  test("given minutes, when formatting, then returns minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });

  test("given boundary at 3599 seconds (59 minutes), when formatting, then returns 59m", () => {
    expect(formatDuration(3599)).toBe("59m");
  });

  test("given boundary at 3600 seconds (1 hour), when formatting, then returns 1h", () => {
    expect(formatDuration(3600)).toBe("1h");
  });

  test("given hours, when formatting, then returns hours", () => {
    expect(formatDuration(7200)).toBe("2h");
  });

  test("given boundary at 86399 seconds (23 hours), when formatting, then returns 23h", () => {
    expect(formatDuration(86399)).toBe("23h");
  });

  test("given boundary at 86400 seconds (1 day), when formatting, then returns 1d", () => {
    expect(formatDuration(86400)).toBe("1d");
  });

  test("given days, when formatting, then returns days", () => {
    expect(formatDuration(172800)).toBe("2d");
  });
});

// ─── getTTL ──────────────────────────────────────────────────────────

describe("getTTL", () => {
  test("given s-maxage and max-age, when getting TTL, then prefers s-maxage", () => {
    expect(getTTL("public, max-age=60, s-maxage=3600")).toBe(3600);
  });

  test("given only max-age, when getting TTL, then falls back to max-age", () => {
    expect(getTTL("public, max-age=120")).toBe(120);
  });

  test("given no age directives, when getting TTL, then returns 0", () => {
    expect(getTTL("no-cache")).toBe(0);
  });

  test("given both s-maxage and max-age set to 0, when getting TTL, then returns 0", () => {
    expect(getTTL("public, max-age=0, s-maxage=0")).toBe(0);
  });

  test("given negative max-age, when getting TTL, then returns negative number", () => {
    expect(getTTL("public, max-age=-1")).toBe(-1);
  });

  test("given non-numeric s-maxage, when getting TTL, then returns NaN", () => {
    expect(Number.isNaN(getTTL("s-maxage=foo"))).toBe(true);
  });

  test("given s-maxage with spaces around equals, when getting TTL, then does not parse", () => {
    expect(getTTL("s-maxage = 3600")).toBe(0);
  });
});

// ─── mergeCacheControl ───────────────────────────────────────────────

describe("mergeCacheControl", () => {
  test("given no-cache in any header, when merging, then returns no-cache", () => {
    const result = mergeCacheControl(
      "public, max-age=300",
      "no-cache, no-store",
    );
    expect(result).toBe("no-cache, no-store, must-revalidate");
  });

  test("given multiple headers, when merging, then takes minimum values", () => {
    const result = mergeCacheControl(
      "public, max-age=300, s-maxage=7200",
      "public, max-age=60, s-maxage=600",
    );
    expect(result).toContain("max-age=60");
    expect(result).toContain("s-maxage=600");
  });

  test("given single header, when merging, then returns it unchanged", () => {
    const header = "public, max-age=300";
    expect(mergeCacheControl(header)).toBe(header);
  });

  test("given empty headers array, when merging, then returns no-cache", () => {
    expect(mergeCacheControl()).toBe("no-cache");
  });

  test("given all headers with no-cache, when merging, then returns no-cache", () => {
    const result = mergeCacheControl("no-cache", "no-store");
    expect(result).toBe("no-cache, no-store, must-revalidate");
  });

  test("given headers with no max-age, when merging, then defaults to 0", () => {
    const result = mergeCacheControl("public", "public");
    expect(result).toBe("public, max-age=0");
  });

  test("given one header with s-maxage and one without, when merging, then keeps s-maxage", () => {
    const result = mergeCacheControl(
      "public, max-age=300",
      "public, max-age=60, s-maxage=600",
    );
    expect(result).toContain("max-age=60");
    expect(result).toContain("s-maxage=600");
  });

  test("given headers with only boolean directives, when merging, then defaults max-age to 0", () => {
    const result = mergeCacheControl("public", "must-revalidate");
    expect(result).toBe("public, max-age=0");
  });
});

// ─── createCacheRoute ────────────────────────────────────────────────

describe("createCacheRoute", () => {
  test("given preset name, when creating route, then applies preset values", () => {
    const route = createCacheRoute("/api", "api");
    expect(route.pattern).toBe("/api");
    expect(route.maxAge).toBe(30);
    expect(route.sMaxAge).toBe(300);
    expect(route.staleWhileRevalidate).toBe(3600);
  });

  test("given overrides, when creating route, then overrides preset values", () => {
    const route = createCacheRoute("/api", "api", { maxAge: 10 });
    expect(route.maxAge).toBe(10);
    expect(route.sMaxAge).toBe(300); // unchanged from preset
  });

  test("given regex pattern, when creating route, then preserves pattern", () => {
    const route = createCacheRoute(/^\/api\/v\d+/, "api");
    expect(route.pattern).toEqual(/^\/api\/v\d+/);
    expect(route.maxAge).toBe(30);
  });

  test("given noCache preset, when creating route, then includes no-cache directives", () => {
    const route = createCacheRoute("/auth", "noCache");
    expect(route.maxAge).toBe(0);
    expect(route.sMaxAge).toBe(0);
    expect(route.customDirectives).toContain("no-cache");
    expect(route.customDirectives).toContain("no-store");
  });

  test("given override of customDirectives, when creating route, then uses override", () => {
    const route = createCacheRoute("/custom", "content", {
      customDirectives: ["private"],
    });
    expect(route.customDirectives).toEqual(["private"]);
  });

  test("given override of sMaxAge only, when creating route, then preserves other preset values", () => {
    const route = createCacheRoute("/api", "content", { sMaxAge: 3600 });
    expect(route.maxAge).toBe(300); // from content preset
    expect(route.sMaxAge).toBe(3600); // overridden
    expect(route.staleWhileRevalidate).toBe(86400); // from content preset
  });
});

// ─── CachePresets ────────────────────────────────────────────────────

describe("CachePresets", () => {
  test("all presets have required fields", () => {
    for (const [_name, preset] of Object.entries(CachePresets)) {
      expect(typeof preset.maxAge).toBe("number");
      expect(typeof preset.sMaxAge).toBe("number");
      expect(typeof preset.staleWhileRevalidate).toBe("number");
    }
  });

  test("content preset has expected values", () => {
    expect(CachePresets.content.maxAge).toBe(300);
    expect(CachePresets.content.sMaxAge).toBe(7200);
    expect(CachePresets.content.staleWhileRevalidate).toBe(86400);
  });

  test("staticAssets preset has immutable directive", () => {
    expect(CachePresets.staticAssets.customDirectives).toContain("immutable");
    expect(CachePresets.staticAssets.maxAge).toBe(31536000);
  });

  test("api preset has short TTL values", () => {
    expect(CachePresets.api.maxAge).toBe(30);
    expect(CachePresets.api.sMaxAge).toBe(300);
    expect(CachePresets.api.staleWhileRevalidate).toBe(3600);
  });

  test("dynamic preset has expected values", () => {
    expect(CachePresets.dynamic.maxAge).toBe(60);
    expect(CachePresets.dynamic.sMaxAge).toBe(300);
    expect(CachePresets.dynamic.staleWhileRevalidate).toBe(3600);
  });

  test("noCache preset has no-store and no-cache directives", () => {
    expect(CachePresets.noCache.customDirectives).toContain("no-cache");
    expect(CachePresets.noCache.customDirectives).toContain("no-store");
    expect(CachePresets.noCache.customDirectives).toContain("must-revalidate");
    expect(CachePresets.noCache.maxAge).toBe(0);
    expect(CachePresets.noCache.sMaxAge).toBe(0);
  });
});
