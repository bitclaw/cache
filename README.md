# @sqlite-saas/cache

Framework-agnostic caching middleware for edge CDNs (Cloudflare, Fastly, etc.)

## Features

- ✅ **Framework-agnostic core** - Works with any Node.js framework
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Edge CDN optimized** - Built for Cloudflare, Fastly, and other edge platforms
- ✅ **Zero dependencies** - Lightweight and fast
- ✅ **Flexible configuration** - Route patterns, TTLs, custom directives
- ✅ **Stale-while-revalidate** - Serve stale content while fetching fresh
- ✅ **Built-in presets** - Common caching strategies out of the box

## Installation

```bash
bun add @sqlite-saas/cache
```

## Quick Start

### Remix/React Router

```typescript
import { getCacheHeaders } from '@sqlite-saas/cache'
import { getRemixCacheHeaders } from '@sqlite-saas/cache/adapters/remix'

// Define your cache configuration
const cacheConfig = {
  routes: [
    {
      pattern: /^\/blog/,
      maxAge: 300,              // 5 min browser cache
      sMaxAge: 7200,            // 2 hour CDN cache
      staleWhileRevalidate: 86400, // 24 hour stale
    },
    {
      pattern: /^\/docs/,
      maxAge: 600,              // 10 min browser cache
      sMaxAge: 7200,            // 2 hour CDN cache
      staleWhileRevalidate: 86400,
    },
  ],
  excludeWhenAuthenticated: true,
  enabled: process.env.NODE_ENV === 'production',
}

// Use in your loader
export async function loader({ request }: LoaderFunctionArgs) {
  const data = await fetchData()

  const headers = getRemixCacheHeaders(cacheConfig, request)
  return json(data, { headers })
}
```

### Framework-Agnostic Usage

```typescript
import { getCacheHeaders, shouldCache } from '@sqlite-saas/cache'

const cacheConfig = {
  routes: [
    {
      pattern: '/api/posts',
      maxAge: 60,
      sMaxAge: 300,
      staleWhileRevalidate: 3600,
    },
  ],
}

// In your route handler
const headers = getCacheHeaders(cacheConfig, request.url)

// Or check if should cache
const canCache = shouldCache(cacheConfig, {
  url: '/api/posts',
  method: 'GET',
  isAuthenticated: false,
  isProduction: true,
})
```

## Configuration

### CacheConfig

```typescript
type CacheConfig = {
  // Array of route patterns with their cache settings
  routes: CacheRouteConfig[]

  // Default max-age for routes not matching any pattern (default: 0)
  defaultMaxAge?: number

  // Enable or disable caching globally (default: true)
  enabled?: boolean

  // Whether to exclude caching for authenticated users (default: true)
  excludeWhenAuthenticated?: boolean

  // Additional patterns to exclude from caching
  excludePatterns?: Array<string | RegExp>
}
```

### CacheRouteConfig

```typescript
type CacheRouteConfig = {
  // URL pattern to match (string for exact match, RegExp for pattern)
  pattern: string | RegExp

  // Browser cache TTL in seconds (max-age)
  maxAge: number

  // CDN cache TTL in seconds (s-maxage)
  sMaxAge: number

  // Stale-while-revalidate time in seconds
  staleWhileRevalidate: number

  // Optional custom Cache-Control directives
  customDirectives?: string[]
}
```

## Built-in Presets

Use predefined caching strategies for common scenarios:

```typescript
import { CachePresets, createCacheRoute } from '@sqlite-saas/cache'

const cacheConfig = {
  routes: [
    // Blog posts: 5min browser, 2h CDN, 24h stale
    createCacheRoute(/^\/blog/, 'content'),

    // Static assets: 1 year immutable
    createCacheRoute(/\.(js|css|png|jpg)$/, 'staticAssets'),

    // API responses: 30s browser, 5min CDN, 1h stale
    createCacheRoute(/^\/api/, 'api'),

    // Dynamic pages: 1min browser, 5min CDN, 1h stale
    createCacheRoute('/', 'dynamic'),
  ],
}
```

### Available Presets

| Preset | Browser Cache | CDN Cache | Stale While Revalidate | Use Case |
|--------|--------------|-----------|------------------------|----------|
| `content` | 5 min | 2 hours | 24 hours | Blog posts, docs, help pages |
| `staticAssets` | 1 year | 1 year | - | CSS, JS, images with hashed names |
| `api` | 30 sec | 5 min | 1 hour | API responses |
| `dynamic` | 1 min | 5 min | 1 hour | Homepage, dashboards |
| `noCache` | 0 | 0 | - | Always fetch fresh |

## Advanced Usage

### Pattern Matching

```typescript
const cacheConfig = {
  routes: [
    // Exact string match
    { pattern: '/about', maxAge: 300, sMaxAge: 3600, staleWhileRevalidate: 86400 },

    // String prefix match
    { pattern: '/blog', maxAge: 300, sMaxAge: 7200, staleWhileRevalidate: 86400 },

    // Regular expression
    { pattern: /^\/docs\/.+/, maxAge: 600, sMaxAge: 7200, staleWhileRevalidate: 86400 },

    // File extension match
    { pattern: /\.(jpg|png|gif|svg)$/, maxAge: 31536000, sMaxAge: 31536000, staleWhileRevalidate: 0 },
  ],
}
```

### Custom Directives

```typescript
const cacheConfig = {
  routes: [
    {
      pattern: '/immutable-assets',
      maxAge: 31536000,
      sMaxAge: 31536000,
      staleWhileRevalidate: 0,
      customDirectives: ['immutable'],
    },
    {
      pattern: '/private-data',
      maxAge: 0,
      sMaxAge: 0,
      staleWhileRevalidate: 0,
      customDirectives: ['private', 'no-store'],
    },
  ],
}
```

### Exclude Patterns

```typescript
const cacheConfig = {
  routes: [
    { pattern: /^\//, maxAge: 300, sMaxAge: 3600, staleWhileRevalidate: 86400 },
  ],
  excludePatterns: [
    '/admin',           // No caching for admin routes
    /^\/api\/auth/,     // No caching for auth endpoints
    /\?.*nocache/,      // No caching with nocache query param
  ],
}
```

### Environment-Specific Configuration

```typescript
const cacheConfig = {
  routes: [
    { pattern: /^\/blog/, maxAge: 300, sMaxAge: 7200, staleWhileRevalidate: 86400 },
  ],
  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',
  // Don't cache for authenticated users
  excludeWhenAuthenticated: true,
}
```

## Remix Adapter

### Basic Usage

```typescript
import { getRemixCacheHeaders } from '@sqlite-saas/cache/adapters/remix'

export async function loader({ request }: LoaderFunctionArgs) {
  const data = await fetchBlogPosts()

  const headers = getRemixCacheHeaders(cacheConfig, request)
  return json(data, { headers })
}
```

### With Authentication Context

```typescript
import { getUser } from '#app/utils/auth.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request)
  const data = await fetchData()

  const headers = getRemixCacheHeaders(cacheConfig, request, {
    isAuthenticated: !!user,
    isProduction: process.env.NODE_ENV === 'production',
  })

  return json(data, { headers })
}
```

### Middleware-Style Wrapper

```typescript
import { withCache } from '@sqlite-saas/cache/adapters/remix'

export const loader = withCache(cacheConfig, async ({ request }) => {
  const data = await fetchData()
  return json(data)
})
```

### Headers Function

```typescript
import { createRemixCacheHeaders } from '@sqlite-saas/cache/adapters/remix'

export const headers = createRemixCacheHeaders(cacheConfig)

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = getRemixCacheHeaders(cacheConfig, request)
  return json(data, { headers })
}
```

## Utility Functions

### Parse Cache-Control Header

```typescript
import { parseCacheControl } from '@sqlite-saas/cache'

const parsed = parseCacheControl('public, max-age=3600, s-maxage=7200')
// { public: true, 'max-age': '3600', 's-maxage': '7200' }
```

### Format Duration

```typescript
import { formatDuration } from '@sqlite-saas/cache'

formatDuration(300)    // '5m'
formatDuration(7200)   // '2h'
formatDuration(86400)  // '1d'
```

### Get TTL

```typescript
import { getTTL } from '@sqlite-saas/cache'

const ttl = getTTL('public, max-age=300, s-maxage=3600')
// 3600 (prefers s-maxage over max-age)
```

### Merge Cache-Control Headers

```typescript
import { mergeCacheControl } from '@sqlite-saas/cache'

const merged = mergeCacheControl(
  'public, max-age=300',
  'public, max-age=600'
)
// 'public, max-age=300' (takes most restrictive)
```

## Cloudflare Integration

### Cache Rule Setup

This package generates `Cache-Control` and `CDN-Cache-Control` headers that work seamlessly with Cloudflare cache rules.

**Cloudflare Cache Rule (via CLI):**

```bash
bun run deploy:cache:create --app myapp --type content
```

This creates a cache rule that:
- Matches `/blog/*`, `/docs/*`, `/changelog/*`, `/help/*`
- Caches everything (respects origin headers)
- 2-hour edge TTL
- Serves stale while updating

**Manual Setup:**

1. Go to Cloudflare Dashboard → Cache → Cache Rules
2. Click "Create Rule"
3. Set:
   - **IF:** `http.request.uri.path matches "^/(blog|docs|changelog|help)/.*"`
   - **THEN:** Cache eligibility: "Cache Everything"
   - **Edge TTL:** "Respect origin" or "Override" with 7200 seconds

### Verifying Cache

```bash
# Check response headers
curl -I https://yourdomain.com/blog/my-post

# Look for:
# cf-cache-status: HIT
# cache-control: public, max-age=300, s-maxage=7200, stale-while-revalidate=86400
```

**Cache Status Values:**
- `MISS` - Not in cache, fetched from origin
- `HIT` - Served from cache
- `EXPIRED` - Cached but expired, revalidating
- `UPDATING` - Serving stale while fetching fresh
- `BYPASS` - Cache rules bypassed

## Examples

### Complete Remix App Example

```typescript
// app/utils/cache.config.ts
import { CacheConfig, createCacheRoute } from '@sqlite-saas/cache'

export const cacheConfig: CacheConfig = {
  routes: [
    createCacheRoute(/^\/blog/, 'content'),
    createCacheRoute(/^\/docs/, 'content'),
    createCacheRoute(/^\/changelog/, 'content'),
    createCacheRoute(/^\/help/, 'content'),
    createCacheRoute(/^\/api/, 'api'),
    createCacheRoute(/\.(js|css|png|jpg|svg|woff2?)$/, 'staticAssets'),
  ],
  excludeWhenAuthenticated: true,
  excludePatterns: ['/admin', /^\/api\/auth/],
  enabled: process.env.NODE_ENV === 'production',
}

// app/routes/blog.$slug.tsx
import { getRemixCacheHeaders } from '@sqlite-saas/cache/adapters/remix'
import { cacheConfig } from '#app/utils/cache.config'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const post = await getBlogPost(params.slug)

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  const headers = getRemixCacheHeaders(cacheConfig, request)
  return json({ post }, { headers })
}

export default function BlogPost() {
  const { post } = useLoaderData<typeof loader>()
  return <article>{/* render post */}</article>
}
```

## API Reference

### Core Functions

#### `shouldCache(config, context)`

Check if a request should be cached.

```typescript
function shouldCache(config: CacheConfig, context: CacheContext): boolean
```

#### `getCacheHeaders(config, url)`

Get cache headers for a URL.

```typescript
function getCacheHeaders(config: CacheConfig, url: string): Record<string, string>
```

#### `evaluateCache(config, context)`

Evaluate caching and return detailed result.

```typescript
function evaluateCache(config: CacheConfig, context: CacheContext): CacheResult
```

### Remix Adapter Functions

#### `getRemixCacheHeaders(config, request, context?)`

Get cache headers for Remix loader.

```typescript
function getRemixCacheHeaders(
  config: CacheConfig,
  request: Request,
  context?: { isAuthenticated?: boolean; isProduction?: boolean }
): Headers
```

#### `withCache(config, loader)`

Middleware-style wrapper for Remix loaders.

```typescript
function withCache<T>(
  config: CacheConfig,
  loader: (args: LoaderFunctionArgs) => Promise<Response> | Response
): (args: LoaderFunctionArgs) => Promise<Response> | Response
```

## Best Practices

### 1. Use Appropriate TTLs

- **Content (blog, docs):** 5min browser, 2h CDN, 24h stale
- **Static assets:** 1 year with immutable (use hashed filenames)
- **API responses:** 30s-5min depending on freshness needs
- **Dynamic pages:** 1-5min depending on update frequency

### 2. Stale-While-Revalidate

Always use `stale-while-revalidate` for content that can tolerate slight staleness:
- Serves cached content instantly
- Updates cache in background
- Zero perceived latency for users

### 3. Exclude Authenticated Routes

Set `excludeWhenAuthenticated: true` to prevent caching personalized content.

### 4. Test Cache Behavior

```bash
# First request (MISS)
curl -I https://yourdomain.com/blog/my-post | grep cf-cache-status

# Second request (HIT)
curl -I https://yourdomain.com/blog/my-post | grep cf-cache-status
```

### 5. Cache Invalidation

When content changes, purge cache via Cloudflare API:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://yourdomain.com/blog/my-post"]}'
```

## License

MIT

## Contributing

Contributions welcome! This package is designed to be framework-agnostic, so we welcome adapters for other frameworks (Express, Fastify, Hono, etc.).

## Roadmap

- [ ] Express adapter
- [ ] Fastify adapter
- [ ] Hono adapter
- [ ] Cache warming utilities
- [ ] Cache invalidation helpers
- [ ] Performance monitoring hooks
