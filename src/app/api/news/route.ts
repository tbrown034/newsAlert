import { NextResponse } from 'next/server';
import { fetchRssFeed } from '@/lib/rss';
import { readTelegramPosts } from '@/lib/telegram-reader';
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
const DEFAULT_TIME_WINDOW = 12; // 12 hours default
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
 * Fetch sources - RSS first (fast), then Bluesky (batched)
 */
async function fetchAllSources(
  sources: TieredSource[]
): Promise<NewsItem[]> {
  const rssSources = sources.filter(s => !isBlueskySource(s));
  const blueskySources = sources.filter(isBlueskySource);

  const allItems: NewsItem[] = [];

  // Fetch all RSS sources in parallel (they're fast)
  const rssPromises = rssSources.map(async (source) => {
    try {
      return await fetchRssFeed(source);
    } catch {
      return [];
    }
  });

  const rssResults = await Promise.allSettled(rssPromises);
  for (const result of rssResults) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Fetch Bluesky in batches
  const BATCH_SIZE = 50;
  const BATCH_DELAY = 50;

  for (let i = 0; i < blueskySources.length; i += BATCH_SIZE) {
    const batch = blueskySources.slice(i, i + BATCH_SIZE);

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

    if (i + BATCH_SIZE < blueskySources.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  // Add Telegram posts from cached JSON
  try {
    const telegramPosts = readTelegramPosts();
    if (telegramPosts.length > 0) {
      console.log(`[News API] Adding ${telegramPosts.length} Telegram posts`);
      allItems.push(...telegramPosts);
    }
  } catch (error) {
    console.error('[News API] Error reading Telegram posts:', error);
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
      const seen = new Set<string>();
      const deduped = items.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
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
