import { NextResponse } from 'next/server';
import { fetchRssFeed } from '@/lib/rss';
import {
  tier1Sources,
  tier2Sources,
  tier3Sources,
  allTieredSources,
  getSourcesByRegion,
  TieredSource,
  FetchTier,
} from '@/lib/sources-clean';
import { processAlertStatuses, sortByCascadePriority } from '@/lib/alertStatus';
import { calculateRegionActivity } from '@/lib/activityDetection';
import {
  getCachedNews,
  setCachedNews,
  isCacheFresh,
} from '@/lib/newsCache';
import { WatchpointId, NewsItem } from '@/types';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

// Valid regions and tiers
const VALID_REGIONS: WatchpointId[] = ['all', 'us', 'latam', 'middle-east', 'europe-russia', 'asia', 'seismic'];
const VALID_TIERS: FetchTier[] = ['T1', 'T2', 'T3'];

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

// Get sources by tier(s) and optionally filter by region
function getSourcesByTiers(tiers: FetchTier[], region: WatchpointId): TieredSource[] {
  let sources: TieredSource[] = [];

  for (const tier of tiers) {
    switch (tier) {
      case 'T1': sources = [...sources, ...tier1Sources]; break;
      case 'T2': sources = [...sources, ...tier2Sources]; break;
      case 'T3': sources = [...sources, ...tier3Sources]; break;
    }
  }

  // Filter by region if not 'all'
  if (region !== 'all') {
    sources = sources.filter(s => s.region === region || s.region === 'all');
  }

  return sources;
}

// Filter items by time window
function filterByTimeWindow(items: NewsItem[], hours: number): NewsItem[] {
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  return items.filter(item => item.timestamp.getTime() > cutoff);
}

/**
 * Balance feed to ensure OSINT sources get representation
 * Without this, high-frequency news agencies (Reuters, AP) dominate
 * and push out lower-frequency but valuable OSINT accounts
 *
 * Strategy:
 * 1. Reserve 15-20% of slots for OSINT
 * 2. Prioritize source diversity - one item per OSINT source first
 * 3. Fill remaining OSINT slots with most recent items
 */
function balanceFeedBySourceType(items: NewsItem[], limit: number): NewsItem[] {
  // Separate OSINT from other source types
  const osintItems = items.filter(item => item.source.sourceType === 'osint');
  const otherItems = items.filter(item => item.source.sourceType !== 'osint');

  // Target: at least 20% OSINT if available (increased from 15%)
  const osintTarget = Math.floor(limit * 0.20);
  const osintToInclude = Math.min(osintTarget, osintItems.length);

  // First pass: one item per unique OSINT source (source diversity)
  const seenSources = new Set<string>();
  const diverseOsint: NewsItem[] = [];
  const remainingOsint: NewsItem[] = [];

  for (const item of osintItems) {
    if (!seenSources.has(item.source.id)) {
      seenSources.add(item.source.id);
      diverseOsint.push(item);
    } else {
      remainingOsint.push(item);
    }
  }

  // Take diverse items first, then fill with remaining most recent
  let selectedOsint: NewsItem[];
  if (diverseOsint.length >= osintToInclude) {
    // We have enough unique sources - take the most recent from each
    selectedOsint = diverseOsint.slice(0, osintToInclude);
  } else {
    // Take all unique sources, then fill with most recent duplicates
    const slotsRemaining = osintToInclude - diverseOsint.length;
    selectedOsint = [...diverseOsint, ...remainingOsint.slice(0, slotsRemaining)];
  }

  // Fill remaining slots with other items
  const remainingSlots = limit - selectedOsint.length;
  const selectedOther = otherItems.slice(0, remainingSlots);

  // Merge and re-sort by timestamp to maintain chronological order
  const merged = [...selectedOsint, ...selectedOther];
  merged.sort((a, b) => {
    // Alerts first
    if (a.alertStatus !== b.alertStatus) {
      const statusOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
      const aOrder = a.alertStatus ? (statusOrder[a.alertStatus] ?? 3) : 3;
      const bOrder = b.alertStatus ? (statusOrder[b.alertStatus] ?? 3) : 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    // Then by time (newest first)
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  return merged;
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
 * Now supports tiered fetching
 */
async function fetchNewsWithCache(
  region: WatchpointId,
  tiers: FetchTier[] = ['T1', 'T2', 'T3']
): Promise<NewsItem[]> {
  // Create cache key based on region and tiers
  const tierKey = tiers.sort().join('-');
  const cacheKey = `${region}:${tierKey}`;

  // For specific regions with full tiers, try to use "all" cache first
  if (region !== 'all' && tiers.length === 3) {
    const allCached = getCachedNews('all:T1-T2-T3');
    if (allCached && isCacheFresh('all:T1-T2-T3')) {
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

  const sources = getSourcesByTiers(tiers, region);

  const fetchPromise = (async () => {
    try {
      console.log(`[News API] Fetching ${tiers.join(',')} for ${region} (${sources.length} sources)`);
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

      // Filter out low-value travel advisories (only show Level 3-4 in feed)
      // Level 1: Exercise Normal Precautions - not newsworthy
      // Level 2: Exercise Increased Caution - not newsworthy
      // Level 3: Reconsider Travel - show in feed
      // Level 4: Do Not Travel - show in feed
      const filtered = crossPlatformDeduped.filter(item => {
        // Check if it's a travel advisory (has "Level X:" pattern)
        if (item.source.id === 'state-travel-rss' || item.title.match(/Level [12]:/)) {
          // Only show Level 3 or Level 4
          if (item.title.includes('Level 3:') || item.title.includes('Level 4:')) {
            return true;
          }
          // Filter out Level 1 and Level 2
          if (item.title.includes('Level 1:') || item.title.includes('Level 2:')) {
            return false;
          }
        }
        return true;
      });

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
  const tierParam = searchParams.get('tier') || 'T1,T2'; // Default: T1 and T2
  const hoursParam = parseInt(searchParams.get('hours') || String(DEFAULT_TIME_WINDOW), 10);
  const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Validate region
  if (!VALID_REGIONS.includes(regionParam as WatchpointId)) {
    return NextResponse.json(
      { error: 'Invalid region parameter', validRegions: VALID_REGIONS },
      { status: 400 }
    );
  }

  // Parse and validate tiers
  const requestedTiers = tierParam.split(',').map(t => t.trim().toUpperCase()) as FetchTier[];
  const validTiers = requestedTiers.filter(t => VALID_TIERS.includes(t));
  if (validTiers.length === 0) {
    return NextResponse.json(
      { error: 'Invalid tier parameter', validTiers: VALID_TIERS, example: '?tier=T1,T2' },
      { status: 400 }
    );
  }

  const region = regionParam as WatchpointId;
  const tiers = validTiers;
  const hours = Math.min(Math.max(1, isNaN(hoursParam) ? DEFAULT_TIME_WINDOW : hoursParam), MAX_TIME_WINDOW);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);

  // Build cache key
  const tierKey = tiers.sort().join('-');
  const cacheKey = `${region}:${tierKey}`;

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
      fetchNewsWithCache(region, tiers).catch(err => {
        console.error('[News API] Background refresh error:', err);
      });
    } else {
      console.log(`[News API] Fetching fresh data for ${cacheKey}...`);
      newsItems = await fetchNewsWithCache(region, tiers);
    }

    // Filter by region if needed
    let filtered = region === 'all'
      ? newsItems
      : newsItems.filter((item) => item.region === region || item.region === 'all');

    // Apply time window filter
    filtered = filterByTimeWindow(filtered, hours);

    // Process alert statuses - O(n)
    const withAlertStatus = processAlertStatuses(filtered);

    // Sort - alerts first, then chronological
    const sorted = sortByCascadePriority(withAlertStatus);

    // Limit results with tier balancing to ensure OSINT representation
    const limited = balanceFeedBySourceType(sorted, limit);

    // Calculate activity levels - O(n)
    const activity = calculateRegionActivity(filtered);

    return NextResponse.json({
      items: limited,
      activity,
      fetchedAt: new Date().toISOString(),
      totalItems: filtered.length,
      fromCache,
      tiers,
      hoursWindow: hours,
      sourcesCount: getSourcesByTiers(tiers, region).length,
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
        tiers,
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
