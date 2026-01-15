import { NextResponse } from 'next/server';
import { fetchAllRssFeeds } from '@/lib/rss';
import { allSources, getSourcesByRegion } from '@/lib/sources';
import { processAlertStatuses, sortByCascadePriority } from '@/lib/alertStatus';
import {
  calculateAllSourceActivity,
  enrichWithActivityData,
  detectAllRegionalSurges,
} from '@/lib/activityDetection';
// Keyword detection removed - relying on volume indicators only
import { WatchpointId, NewsItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every minute
export const maxDuration = 60; // Allow up to 60 seconds for fetching 285+ sources

// In-memory cache to avoid re-fetching on every request
interface CachedData {
  items: NewsItem[];
  timestamp: number;
}
const newsCache = new Map<string, CachedData>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// Valid regions and limits for input validation
const VALID_REGIONS: WatchpointId[] = ['all', 'middle-east', 'ukraine-russia', 'china-taiwan', 'venezuela', 'us-domestic', 'seismic'];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionParam = searchParams.get('region') || 'all';
  const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);

  // Validate region parameter
  if (!VALID_REGIONS.includes(regionParam as WatchpointId)) {
    return NextResponse.json(
      { error: 'Invalid region parameter', validRegions: VALID_REGIONS },
      { status: 400 }
    );
  }

  const region = regionParam as WatchpointId;
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);

  try {
    // Get sources for the requested region
    // Now using ALL sources with OSINT prioritized (no limit!)
    const sources = region === 'all'
      ? allSources
      : getSourcesByRegion(region);

    // Check cache first
    const cacheKey = region;
    const cached = newsCache.get(cacheKey);
    const now = Date.now();

    let newsItems: NewsItem[];
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      // Use cached data
      newsItems = cached.items;
      console.log(`[News API] Using cached data for ${region} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
    } else {
      // Fetch fresh data
      console.log(`[News API] Fetching fresh data for ${region}...`);
      newsItems = await fetchAllRssFeeds(sources);
      // Store in cache
      newsCache.set(cacheKey, { items: newsItems, timestamp: now });
    }

    // Deduplicate items by ID (can happen when same content appears in multiple feeds)
    const seenIds = new Set<string>();
    const deduplicated = newsItems.filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    });

    // Filter by region if specified
    const filtered = region === 'all'
      ? deduplicated
      : deduplicated.filter((item) => item.region === region || item.region === 'all');

    // Process alert statuses (FIRST/DEVELOPING/CONFIRMED) - legacy
    const withAlertStatus = processAlertStatuses(filtered);

    // Calculate source activity profiles (anomaly detection)
    const activityProfiles = calculateAllSourceActivity(withAlertStatus, allSources);

    // Enrich items with activity data
    const withActivity = enrichWithActivityData(withAlertStatus, activityProfiles);

    // Sort by cascade priority (OSINT first, then recency)
    const sorted = sortByCascadePriority(withActivity);

    // Return limited results
    const limited = sorted.slice(0, limit);

    // Calculate legacy activity levels per region
    const activityByRegion = calculateActivityLevels(newsItems);

    // Detect regional surges (new system)
    const surges = detectAllRegionalSurges(withActivity, activityProfiles);

    return NextResponse.json({
      items: limited,
      activity: activityByRegion,
      surges,
      fetchedAt: new Date().toISOString(),
      totalItems: filtered.length,
    });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', items: [], activity: {} },
      { status: 500 }
    );
  }
}

// Baseline estimates: expected posts per hour under "normal" conditions
// These are estimates based on typical OSINT activity patterns
const REGION_BASELINES: Record<WatchpointId, number> = {
  'middle-east': 8,      // High activity region, many sources
  'ukraine-russia': 10,  // Very active conflict zone
  'china-taiwan': 3,     // Lower baseline, spikes during tensions
  'venezuela': 2,        // Lower activity region
  'us-domestic': 4,      // Moderate baseline
  'seismic': 0,          // Not used for seismic (separate data source)
  'all': 20,             // Combined baseline
};

interface RegionActivity {
  level: string;
  count: number;
  breaking: number;
  baseline: number;
  multiplier: number;      // e.g., 2.5 = 2.5x normal
  vsNormal: string;        // "above" | "below" | "normal"
  percentChange: number;   // e.g., 150 = 150% above normal
}

// Calculate activity levels based on recent news volume vs baseline
function calculateActivityLevels(
  items: { region: WatchpointId; isBreaking?: boolean; timestamp: Date }[]
): Record<WatchpointId, RegionActivity> {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  const regions: WatchpointId[] = [
    'middle-east',
    'ukraine-russia',
    'china-taiwan',
    'venezuela',
    'us-domestic',
  ];

  const activity = {} as Record<WatchpointId, RegionActivity>;

  for (const region of regions) {
    const regionItems = items.filter(
      (item) => item.region === region &&
        now - item.timestamp.getTime() < oneHour
    );
    const breakingCount = regionItems.filter((item) => item.isBreaking).length;
    const totalCount = regionItems.length;
    const baseline = REGION_BASELINES[region] || 5;

    // Calculate multiplier vs baseline
    const multiplier = baseline > 0 ? Math.round((totalCount / baseline) * 10) / 10 : 0;
    const percentChange = baseline > 0 ? Math.round(((totalCount - baseline) / baseline) * 100) : 0;

    // Determine vs normal status
    let vsNormal: string;
    if (multiplier >= 1.3) vsNormal = 'above';
    else if (multiplier <= 0.7) vsNormal = 'below';
    else vsNormal = 'normal';

    // Determine level based on multiplier AND absolute breaking count
    let level: string;
    if (breakingCount >= 3 || multiplier >= 3) level = 'critical';
    else if (breakingCount >= 2 || multiplier >= 2) level = 'high';
    else if (breakingCount >= 1 || multiplier >= 1.5) level = 'elevated';
    else if (multiplier >= 0.5) level = 'normal';
    else level = 'low';

    activity[region] = {
      level,
      count: totalCount,
      breaking: breakingCount,
      baseline,
      multiplier,
      vsNormal,
      percentChange,
    };
  }

  return activity;
}
