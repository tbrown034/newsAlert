# Next.js Architecture Patterns

Reference guide for proper Next.js 15 server/client patterns.

## Server vs Client Components

### Server Components (Default)
- Render on the server, send HTML to client
- Can directly access backend resources (databases, APIs, file system)
- Keep sensitive data server-side (API keys, tokens)
- Reduce client-side JavaScript bundle
- **Cannot** use React hooks (`useState`, `useEffect`, etc.)
- **Cannot** use browser APIs

### Client Components
- Add `'use client'` directive at the top of the file
- Required for interactivity (event handlers, state)
- Required for browser APIs
- Required for React hooks

```typescript
'use client';
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### When to Use What

| Feature | Server | Client |
|---------|--------|--------|
| Fetch data | ✅ | ⚠️ (use SWR/React Query) |
| Access backend | ✅ | ❌ |
| Sensitive env vars | ✅ | ❌ |
| Interactivity | ❌ | ✅ |
| State/Effects | ❌ | ✅ |
| Browser APIs | ❌ | ✅ |

## Data Fetching Patterns

### Server Component Fetching (Preferred)
```typescript
// app/page.tsx - Server Component
async function getData() {
  const res = await fetch('https://api.example.com/data');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default async function Page() {
  const data = await getData();
  return <main>{/* render data */}</main>;
}
```

### Client Component Fetching
```typescript
'use client';
import { useState, useEffect } from 'react';

export function DataComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{/* render data */}</div>;
}
```

## Caching Strategies

### Route Segment Config
```typescript
// Force dynamic rendering (no cache)
export const dynamic = 'force-dynamic';

// Revalidate every 60 seconds
export const revalidate = 60;
```

### Fetch Cache Options
```typescript
// Cache indefinitely (default in production)
fetch(url);

// Revalidate every 60 seconds
fetch(url, { next: { revalidate: 60 } });

// No cache - always fresh
fetch(url, { cache: 'no-store' });
```

### Cache Components (Next.js 15+)
```typescript
'use cache';

export async function CachedData() {
  const data = await fetch('...');
  return <div>{data}</div>;
}
```

#### Cache Profiles with `cacheLife`
```typescript
import { cacheLife } from 'next/cache';

export async function getData() {
  'use cache';
  cacheLife('hours'); // Built-in profiles: seconds, minutes, hours, days, weeks, max
  return fetch('...');
}

// Custom profile in next.config.js
cacheLife({
  stale: 300,      // 5 minutes stale
  revalidate: 60,  // revalidate every minute
  expire: 3600,    // expire after 1 hour
});
```

#### Cache Tags with `cacheTag`
```typescript
import { cacheTag } from 'next/cache';

export async function getNews(region: string) {
  'use cache';
  cacheTag('news', `news-${region}`);
  return fetch(`/api/news?region=${region}`);
}

// Revalidate specific tags
import { revalidateTag } from 'next/cache';
revalidateTag('news-middle-east');
```

## Streaming & Suspense

### loading.js (Route-level)
```typescript
// app/news/loading.tsx
export default function Loading() {
  return <NewsSkeleton />;
}
```

### Suspense (Component-level)
```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <main>
      <h1>News</h1>
      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection />
      </Suspense>
      <Suspense fallback={<BriefingSkeleton />}>
        <AIBriefing />
      </Suspense>
    </main>
  );
}
```

### Streaming with async Components
```typescript
async function SlowComponent() {
  const data = await fetchSlowData(); // This streams in
  return <div>{data}</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SlowComponent />
    </Suspense>
  );
}
```

## Error Handling

### error.js (Route-level)
```typescript
'use client'; // Error components must be Client Components

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### Global Error (app/global-error.tsx)
```typescript
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

## API Routes (Route Handlers)

```typescript
// app/api/news/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || 'all';

  try {
    const data = await fetchNews(region);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch' },
      { status: 500 }
    );
  }
}
```

## Best Practices for This Project

### 1. Keep API routes simple
- Single responsibility
- Don't re-fetch data that's already cached
- Return early with partial data if full data isn't ready

### 2. Use proper caching
- Cache expensive operations (AI calls, large fetches)
- Use stale-while-revalidate for real-time data
- Don't over-fetch - batch requests where possible

### 3. Progressive loading
- Show skeleton immediately
- Stream in data as it arrives
- Don't block the whole UI for slow operations

### 4. Client components should be minimal
- Only use `'use client'` when necessary
- Keep state as close to where it's used as possible
- Avoid prop drilling - use composition

### 5. Error boundaries
- Wrap risky operations in try/catch
- Show user-friendly error states
- Provide retry mechanisms

---

## Performance Optimization Log (Jan 2026)

### Problem
Initial page load was taking 10-25 seconds due to:
1. **Double-fetch issue**: Page fetched "all" data, then auto-selected region and fetched again
2. **O(n²) processing**: Alert status checked every item against every other item (500×500 = 250,000 comparisons)
3. **Per-region cache miss**: Each region had its own cache, triggering fresh fetches when switching
4. **Client-side fetching**: Used `useEffect` for initial data, causing loading spinner delay

### Solutions Implemented

#### 1. Simplified Alert Status Logic (`src/lib/alertStatus.ts`)
**Before**: O(n²) - compared every item to every other item for "similarity"
```typescript
// Old: For each item, extract keywords and compare to ALL other items
function isSimilar(title1, title2) {
  const words1 = extractKeywords(title1);  // Called N×N times
  const words2 = extractKeywords(title2);  // ...
}
```

**After**: O(n) - single pass keyword scan
```typescript
// New: Just check for keywords once per item
function hasAlertKeywords(title: string): boolean {
  return ALERT_KEYWORDS.some(kw => title.toLowerCase().includes(kw));
}
```

**Impact**: Processing time dropped from ~4600ms to ~10ms

#### 2. Simplified Activity Detection (`src/lib/activityDetection.ts`)
**Before**: Per-source activity tracking with baseline comparisons
**After**: Simple region-level post counts vs hardcoded baselines

#### 3. Server-Side Initial Fetch (`src/app/page.tsx`)
**Before**: Client component with `useEffect` fetch
```typescript
'use client';
useEffect(() => {
  fetch('/api/news')...
}, []);
```

**After**: Server component fetches before render
```typescript
export default async function Home() {
  const data = await fetch('/api/news');
  return <HomeClient initialData={data} />;
}
```

**Impact**: Eliminated loading spinner, page renders with data

#### 4. Cache Sharing Optimization (`src/app/api/news/route.ts`)
**Before**: Each region had separate cache, switching triggered fresh fetch
**After**: Specific regions filter from "all" cache if available
```typescript
if (region !== 'all') {
  const allCached = getCachedNews('all');
  if (allCached && isCacheFresh('all')) {
    // Filter from cache - instant!
    return allCached.items.filter(item => item.region === region);
  }
}
```

**Impact**: Region switch went from ~2.7s to ~32-64ms

### Performance Results

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Cold start (new user) | ~10-25s | ~4.5s | 2-5x faster |
| Returning user (cached) | ~4s | ~180ms | 22x faster |
| Region switch (first time) | ~2.7s | ~50ms | 54x faster |
| Alert processing | ~4600ms | ~10ms | 460x faster |

### Remaining Bottlenecks

1. **Cold start still ~4.5s**: Bluesky API fetching 275 accounts in batches. Inherent latency.
2. **AI Summary ~8-10s**: Claude API call for summarization. Could pre-warm cache.
3. **No streaming**: Page waits for all data before rendering. Could use Suspense.

### Future Optimizations

1. **Suspense streaming**: Render shell immediately, stream in data
2. **Pre-warm AI cache**: Generate summaries in background
3. **Edge caching**: Use Vercel Edge for global cache
4. **WebSocket updates**: Push new items instead of polling

---

## Bluesky API Reference

### Public API Base URL
All public endpoints can be called without authentication:
```
https://public.api.bsky.app/xrpc/
```

### Key Endpoints for Source Discovery & Verification

#### 1. Search for Accounts
```bash
# Find accounts by keyword (no auth required)
GET https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=reuters&limit=25

# Supports Lucene query syntax
# Returns: actors[], cursor
```

#### 2. Get Profile Details
```bash
# Get account metadata (followers, posts count, etc.)
GET https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=reuters.com

# Returns: did, handle, displayName, description, followersCount, followsCount, postsCount
```

#### 3. Get Author Feed (Activity Check)
```bash
# Get recent posts from an account
GET https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=reuters.com&limit=100

# Filters: posts_with_replies, posts_no_replies, posts_with_media, posts_and_author_threads
# Returns: feed[], cursor
```

#### 4. Search Posts
```bash
# Search posts by keyword, author, hashtag, etc.
GET https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=breaking&limit=25

# Useful params:
# - sort: "latest" or "top"
# - since/until: datetime filters (YYYY-MM-DD or ISO datetime)
# - author: filter by account handle
# - mentions: filter by mentioned account
# - tag: filter by hashtag (without #)
# - lang: filter by language code
# - domain: filter by linked domain
```

### Example: Calculate Posts Per Day
```typescript
// Fetch last 100 posts and calculate posting frequency
const response = await fetch(
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=100`
);
const { feed } = await response.json();

if (feed.length >= 2) {
  const newest = new Date(feed[0].post.record.createdAt);
  const oldest = new Date(feed[feed.length - 1].post.record.createdAt);
  const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
  const postsPerDay = feed.length / daySpan;
}
```

### Example: Verify Account is Active
```typescript
// Check if account posted in last 24 hours
const response = await fetch(
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=1`
);
const { feed } = await response.json();

if (feed.length > 0) {
  const lastPost = new Date(feed[0].post.record.createdAt);
  const hoursSincePost = (Date.now() - lastPost) / (1000 * 60 * 60);
  const isActive = hoursSincePost < 24;
}
```

### Rate Limits
- Public API: ~3000 requests/5 minutes (unauth)
- Authenticated: Higher limits with app password
- Best practice: Batch requests with 500ms delays

### Useful Third-Party Tools (from Reddit)
- **Bluesky Analytics** - Profile analytics
- **TrendSpotter** - Discover trends and viral posts
- **Fedica** - Posting analysis and insights
- **TrackBlue** - Schedule posts, track engagement
- **Blueskyhunter** - Account discovery
- **clearsky.app** - Block/moderation lists
- **bsky.jazco.dev** - Post search and analytics

### Finding News Accounts
1. **Search by keyword**: `app.bsky.actor.searchActors?q=news`
2. **Check verified domains**: Accounts like `reuters.com`, `nytimes.com` have domain handles
3. **Look at who news orgs follow**: Use `app.bsky.graph.getFollows`
4. **Monitor trending topics**: Use `app.bsky.feed.searchPosts?sort=top`

### Starter Packs for News
Bluesky has "Starter Packs" - curated lists of accounts. Look for:
- Journalism starter packs
- News organization lists
- OSINT community packs
