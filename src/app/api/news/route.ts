import { NextResponse } from 'next/server';
import { fetchRssFeed } from '@/lib/rss';
import {
  allTieredSources,
  getSourcesByRegion,
  TieredSource,
} from '@/lib/sources-clean';
import { processAlertStatuses, sortByCascadePriority } from '@/lib/alertStatus';
import { calculateRegionActivity } from '@/lib/activityDetection';
import {
  getCachedNews,
  setCachedNews,
  isCacheFresh,
} from '@/lib/newsCache';
import { WatchpointId, NewsItem, Source } from '@/types';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit';
import { getActiveEditorialPosts } from '@/lib/editorial';
import { EditorialPost } from '@/types/editorial';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

// Valid regions
const VALID_REGIONS: WatchpointId[] = ['all', 'us', 'latam', 'middle-east', 'europe-russia', 'asia', 'seismic'];

// Time window defaults (in hours)
const DEFAULT_TIME_WINDOW = 6; // 6 hours - optimized for "what's happening NOW"
const MAX_TIME_WINDOW = 72; // Max 3 days

// Limits (for safety)
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 200;

// Track in-flight fetches to prevent duplicate requests
const inFlightFetches = new Map<string, Promise<NewsItem[]>>();


// Check if source is Bluesky
function isBlueskySource(source: TieredSource): boolean {
  return source.platform === 'bluesky' || source.feedUrl.includes('bsky.app');
}

// Check if source is Telegram
function isTelegramSource(source: TieredSource): boolean {
  return source.platform === 'telegram' || source.feedUrl.includes('t.me/');
}

// Check if source is Mastodon
function isMastodonSource(source: TieredSource): boolean {
  return source.platform === 'mastodon';
}

// Check if source is Reddit
function isRedditSource(source: TieredSource): boolean {
  return source.platform === 'reddit' || source.feedUrl.includes('reddit.com/r/');
}

// Check if source is YouTube
function isYouTubeSource(source: TieredSource): boolean {
  return source.platform === 'youtube' || source.feedUrl.includes('youtube.com/feeds/');
}

// Get sources filtered by region (all sources, no tier separation)
function getSourcesForRegion(region: WatchpointId): TieredSource[] {
  return getSourcesByRegion(region);
}

// Filter items by time window
function filterByTimeWindow(items: NewsItem[], hours: number): NewsItem[] {
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  return items.filter(item => item.timestamp.getTime() > cutoff);
}

// Convert editorial post to NewsItem format for rendering
function editorialToNewsItem(post: EditorialPost): NewsItem & { isEditorial: true; editorialType: string } {
  const editorSource: Source = {
    id: 'editorial',
    name: 'Editor',
    platform: 'rss', // Use RSS as base platform for editorial
    sourceType: 'official',
    confidence: 100,
    region: post.region || 'all',
  };

  return {
    id: `editorial-${post.id}`,
    title: post.title,
    content: post.content || post.title,
    source: editorSource,
    timestamp: post.createdAt,
    region: post.region || 'all',
    verificationStatus: 'confirmed',
    url: post.url,
    media: post.mediaUrl ? [{ type: 'image', url: post.mediaUrl }] : undefined,
    // Custom fields for editorial posts
    isEditorial: true as const,
    editorialType: post.postType,
  };
}

/**
 * Fetch sources - grouped by platform with appropriate batching
 */
async function fetchAllSources(
  sources: TieredSource[]
): Promise<NewsItem[]> {
  // Separate sources by platform
  const blueskySources = sources.filter(isBlueskySource);
  const telegramSources = sources.filter(isTelegramSource);
  const mastodonSources = sources.filter(isMastodonSource);
  const redditSources = sources.filter(isRedditSource);
  const youtubeSources = sources.filter(isYouTubeSource);

  // RSS = everything else
  const rssSources = sources.filter(s =>
    !isBlueskySource(s) &&
    !isTelegramSource(s) &&
    !isMastodonSource(s) &&
    !isRedditSource(s) &&
    !isYouTubeSource(s)
  );

  const allItems: NewsItem[] = [];

  // Fetch RSS sources in batches to avoid network saturation
  const RSS_BATCH_SIZE = 30;
  const RSS_BATCH_DELAY = 100;

  for (let i = 0; i < rssSources.length; i += RSS_BATCH_SIZE) {
    const batch = rssSources.slice(i, i + RSS_BATCH_SIZE);

    const batchPromises = batch.map(async (source) => {
      try {
        return await fetchRssFeed(source);
      } catch {
        return [];
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    if (i + RSS_BATCH_SIZE < rssSources.length) {
      await new Promise(r => setTimeout(r, RSS_BATCH_DELAY));
    }
  }

  // Fetch Bluesky in batches
  const BSKY_BATCH_SIZE = 30;
  const BSKY_BATCH_DELAY = 100;

  for (let i = 0; i < blueskySources.length; i += BSKY_BATCH_SIZE) {
    const batch = blueskySources.slice(i, i + BSKY_BATCH_SIZE);

    const batchPromises = batch.map(async (source) => {
      try {
        return await fetchRssFeed(source);
      } catch {
        return [];
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    if (i + BSKY_BATCH_SIZE < blueskySources.length) {
      await new Promise(r => setTimeout(r, BSKY_BATCH_DELAY));
    }
  }

  // Fetch Telegram in batches (web scraping can be slow)
  const TG_BATCH_SIZE = 10;
  const TG_BATCH_DELAY = 200;

  for (let i = 0; i < telegramSources.length; i += TG_BATCH_SIZE) {
    const batch = telegramSources.slice(i, i + TG_BATCH_SIZE);

    const batchPromises = batch.map(async (source) => {
      try {
        return await fetchRssFeed(source);
      } catch {
        return [];
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    if (i + TG_BATCH_SIZE < telegramSources.length) {
      await new Promise(r => setTimeout(r, TG_BATCH_DELAY));
    }
  }

  // Fetch Mastodon in batches (API is generous - 7,500 req/5min)
  const MASTO_BATCH_SIZE = 20;
  const MASTO_BATCH_DELAY = 100;

  for (let i = 0; i < mastodonSources.length; i += MASTO_BATCH_SIZE) {
    const batch = mastodonSources.slice(i, i + MASTO_BATCH_SIZE);

    const batchPromises = batch.map(async (source) => {
      try {
        return await fetchRssFeed(source);
      } catch {
        return [];
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    if (i + MASTO_BATCH_SIZE < mastodonSources.length) {
      await new Promise(r => setTimeout(r, MASTO_BATCH_DELAY));
    }
  }

  // Fetch Reddit in smaller batches (tight rate limit ~10 req/min)
  const REDDIT_BATCH_SIZE = 5;
  const REDDIT_BATCH_DELAY = 500;

  for (let i = 0; i < redditSources.length; i += REDDIT_BATCH_SIZE) {
    const batch = redditSources.slice(i, i + REDDIT_BATCH_SIZE);

    const batchPromises = batch.map(async (source) => {
      try {
        return await fetchRssFeed(source);
      } catch {
        return [];
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    if (i + REDDIT_BATCH_SIZE < redditSources.length) {
      await new Promise(r => setTimeout(r, REDDIT_BATCH_DELAY));
    }
  }

  // Fetch YouTube (standard RSS, moderate batching)
  const YT_BATCH_SIZE = 10;
  const YT_BATCH_DELAY = 100;

  for (let i = 0; i < youtubeSources.length; i += YT_BATCH_SIZE) {
    const batch = youtubeSources.slice(i, i + YT_BATCH_SIZE);

    const batchPromises = batch.map(async (source) => {
      try {
        return await fetchRssFeed(source);
      } catch {
        return [];
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    if (i + YT_BATCH_SIZE < youtubeSources.length) {
      await new Promise(r => setTimeout(r, YT_BATCH_DELAY));
    }
  }

  return allItems;
}

/**
 * Fetch news with caching
 * Simplified: fetches all sources (no tier separation)
 */
async function fetchNewsWithCache(region: WatchpointId): Promise<NewsItem[]> {
  const cacheKey = region;

  // For specific regions, try to use "all" cache first
  if (region !== 'all') {
    const allCached = getCachedNews('all');
    if (allCached && isCacheFresh('all')) {
      const filtered = allCached.items.filter(
        item => item.region === region || item.region === 'all'
      );
      setCachedNews(cacheKey, filtered, true);
      return filtered;
    }
  }

  // Check for in-flight fetch
  const inFlight = inFlightFetches.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const sources = getSourcesForRegion(region);

  const fetchPromise = (async () => {
    try {
      console.log(`[News API] Fetching ${region} (${sources.length} sources)`);
      const items = await fetchAllSources(sources);

      // Deduplicate by ID
      const seenIds = new Set<string>();
      const dedupedById = items.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      // Cross-platform deduplication: remove duplicate content from different platforms
      // Uses normalized title (first 80 chars, lowercase, alphanumeric only) as content key
      const normalizeForDedupe = (title: string): string => {
        return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
      };

      const seenContent = new Map<string, NewsItem>();
      const crossPlatformDeduped = dedupedById.filter(item => {
        const contentKey = normalizeForDedupe(item.title);
        if (contentKey.length < 20) return true; // Too short to dedupe reliably

        const existing = seenContent.get(contentKey);
        if (existing) {
          // Keep the one with higher confidence or from preferred platform
          if (item.source.confidence > existing.source.confidence) {
            seenContent.set(contentKey, item);
            return true;
          }
          return false;
        }
        seenContent.set(contentKey, item);
        return true;
      });

      // State Dept Travel Advisories source removed - was causing noise
      // No travel advisory filtering needed anymore
      const filtered = crossPlatformDeduped;

      // Limit items per source to prevent feed flooding (max 3 per source)
      const MAX_PER_SOURCE = 3;
      const sourceItemCounts = new Map<string, number>();
      const deduped = filtered.filter(item => {
        const count = sourceItemCounts.get(item.source.id) || 0;
        if (count >= MAX_PER_SOURCE) return false;
        sourceItemCounts.set(item.source.id, count + 1);
        return true;
      });

      // Sort by timestamp
      deduped.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Update cache
      setCachedNews(cacheKey, deduped, true);

      return deduped;
    } finally {
      inFlightFetches.delete(cacheKey);
    }
  })();

  inFlightFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function GET(request: Request) {
  // Rate limiting: 120 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`news:${clientIp}`, {
    windowMs: 60000,
    maxRequests: 120,
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimitResult),
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const regionParam = searchParams.get('region') || 'all';
  const hoursParam = parseInt(searchParams.get('hours') || String(DEFAULT_TIME_WINDOW), 10);
  const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const sinceParam = searchParams.get('since'); // ISO timestamp for incremental updates

  // Validate region
  if (!VALID_REGIONS.includes(regionParam as WatchpointId)) {
    return NextResponse.json(
      { error: 'Invalid region parameter', validRegions: VALID_REGIONS },
      { status: 400 }
    );
  }

  const region = regionParam as WatchpointId;
  const hours = Math.min(Math.max(1, isNaN(hoursParam) ? DEFAULT_TIME_WINDOW : hoursParam), MAX_TIME_WINDOW);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);

  // Cache key is just the region (no more tier separation)
  const cacheKey = region;

  try {
    let newsItems: NewsItem[];
    let fromCache = false;

    const cached = getCachedNews(cacheKey);

    if (!forceRefresh && cached && isCacheFresh(cacheKey)) {
      newsItems = cached.items;
      fromCache = true;
    } else if (!forceRefresh && cached) {
      // Stale cache - return immediately, refresh in background
      newsItems = cached.items;
      fromCache = true;
      console.log(`[News API] Stale cache for ${cacheKey}, refreshing in background`);
      fetchNewsWithCache(region).catch(err => {
        console.error('[News API] Background refresh error:', err);
      });
    } else {
      console.log(`[News API] Fetching fresh data for ${cacheKey}...`);
      newsItems = await fetchNewsWithCache(region);
    }

    // Filter by region if needed
    let filtered = region === 'all'
      ? newsItems
      : newsItems.filter((item) => item.region === region || item.region === 'all');

    // Apply time window filter
    filtered = filterByTimeWindow(filtered, hours);

    // If 'since' param provided, only return items newer than that timestamp
    // This enables incremental updates - client fetches only new items
    let sinceCutoff: Date | null = null;
    if (sinceParam) {
      sinceCutoff = new Date(sinceParam);
      if (!isNaN(sinceCutoff.getTime())) {
        filtered = filtered.filter(item => item.timestamp.getTime() > sinceCutoff!.getTime());
      }
    }

    // Fetch editorial posts and merge with feed
    let editorialPosts: EditorialPost[] = [];
    let editorialCount = 0;
    try {
      editorialPosts = await getActiveEditorialPosts(region);
      editorialCount = editorialPosts.length;
    } catch (err) {
      console.error('[News API] Failed to fetch editorial posts:', err);
      // Continue without editorial posts
    }

    // Convert editorial posts to NewsItem format
    const editorialItems = editorialPosts.map(editorialToNewsItem);

    // Separate editorial posts by type for priority ordering
    const breakingPosts = editorialItems.filter(p => p.editorialType === 'breaking');
    const pinnedPosts = editorialItems.filter(p => p.editorialType === 'pinned');
    const contextPosts = editorialItems.filter(p => p.editorialType === 'context');
    const eventPosts = editorialItems.filter(p => p.editorialType === 'event');

    // Process alert statuses - O(n)
    const withAlertStatus = processAlertStatuses(filtered);

    // Sort by published timestamp (pure chronological)
    const sorted = sortByCascadePriority(withAlertStatus);

    // Merge with editorial posts:
    // 1. BREAKING posts at the very top
    // 2. PINNED posts next
    // 3. Context and event posts mixed chronologically with regular feed
    const contextAndEvents = [...contextPosts, ...eventPosts].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Merge context/events into sorted feed chronologically
    const mergedFeed: NewsItem[] = [];
    let feedIdx = 0;
    let editIdx = 0;

    while (feedIdx < sorted.length || editIdx < contextAndEvents.length) {
      if (editIdx >= contextAndEvents.length) {
        mergedFeed.push(sorted[feedIdx++]);
      } else if (feedIdx >= sorted.length) {
        mergedFeed.push(contextAndEvents[editIdx++]);
      } else if (contextAndEvents[editIdx].timestamp >= sorted[feedIdx].timestamp) {
        mergedFeed.push(contextAndEvents[editIdx++]);
      } else {
        mergedFeed.push(sorted[feedIdx++]);
      }
    }

    // Final order: breaking -> pinned -> merged feed
    const finalFeed = [...breakingPosts, ...pinnedPosts, ...mergedFeed];

    // Simple limit - no rebalancing, preserve chronological order
    const limited = finalFeed.slice(0, limit);

    // Calculate activity levels - O(n)
    const activity = calculateRegionActivity(filtered);

    return NextResponse.json({
      items: limited,
      activity,
      fetchedAt: new Date().toISOString(),
      totalItems: filtered.length,
      editorialCount,
      fromCache,
      hoursWindow: hours,
      sourcesCount: getSourcesForRegion(region).length,
      // Incremental update flag - client knows to prepend, not replace
      isIncremental: !!sinceCutoff,
    });
  } catch (error) {
    console.error('News API error:', error);

    // Try to return cached data on error
    const cached = getCachedNews(cacheKey);
    if (cached) {
      console.log('[News API] Returning stale cache due to error');
      const filtered = filterByTimeWindow(cached.items, hours);
      return NextResponse.json({
        items: filtered.slice(0, limit),
        activity: calculateRegionActivity(filtered),
        fetchedAt: new Date().toISOString(),
        totalItems: filtered.length,
        fromCache: true,
        hoursWindow: hours,
        error: 'Partial data - refresh failed',
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch news', items: [], activity: {} },
      { status: 500 }
    );
  }
}
