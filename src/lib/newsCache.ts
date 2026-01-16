/**
 * SHARED NEWS CACHE
 * =================
 * Centralized cache for news items, shared between news and summary endpoints.
 * Uses global singleton pattern to persist across Next.js hot reloads.
 */

import { NewsItem } from '@/types';

interface CachedNewsData {
  items: NewsItem[];
  timestamp: number;
  isComplete: boolean;
}

interface NewsCache {
  data: Map<string, CachedNewsData>;
}

// Use global to persist cache across hot reloads in development
const globalForCache = globalThis as unknown as {
  newsCache: NewsCache | undefined;
};

// Initialize or get existing cache
function getCache(): Map<string, CachedNewsData> {
  if (!globalForCache.newsCache) {
    globalForCache.newsCache = {
      data: new Map<string, CachedNewsData>(),
    };
  }
  return globalForCache.newsCache.data;
}

// Cache TTL - how long before data is considered stale
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Stale-while-revalidate window
const STALE_WHILE_REVALIDATE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached news data for a cache key
 * Cache key can be a region or a composite key like 'all:T1-T2-T3'
 */
export function getCachedNews(cacheKey: string): CachedNewsData | null {
  const cache = getCache();
  const cached = cache.get(cacheKey);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;

  // Return null if data is too old
  if (age > STALE_WHILE_REVALIDATE_MS) {
    cache.delete(cacheKey);
    return null;
  }

  return cached;
}

/**
 * Check if cached data is fresh (within TTL)
 */
export function isCacheFresh(cacheKey: string): boolean {
  const cache = getCache();
  const cached = cache.get(cacheKey);
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_TTL_MS;
}

/**
 * Check if cached data is stale but still usable
 */
export function isCacheStale(cacheKey: string): boolean {
  const cache = getCache();
  const cached = cache.get(cacheKey);
  if (!cached) return false;
  const age = Date.now() - cached.timestamp;
  return age >= CACHE_TTL_MS && age < STALE_WHILE_REVALIDATE_MS;
}

/**
 * Set cached news data
 */
export function setCachedNews(
  cacheKey: string,
  items: NewsItem[],
  isComplete: boolean = true
): void {
  const cache = getCache();
  cache.set(cacheKey, {
    items,
    timestamp: Date.now(),
    isComplete,
  });

  // Also update the 'all:T1-T2-T3' cache when updating specific regions
  const isRegionSpecific = !cacheKey.startsWith('all');
  if (isRegionSpecific) {
    const allCached = cache.get('all:T1-T2-T3');
    if (allCached) {
      // Merge items into 'all' cache
      const itemMap = new Map<string, NewsItem>();
      for (const item of allCached.items) {
        itemMap.set(item.id, item);
      }
      for (const item of items) {
        itemMap.set(item.id, item);
      }
      const merged = Array.from(itemMap.values()).sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      cache.set('all:T1-T2-T3', {
        items: merged,
        timestamp: allCached.timestamp,
        isComplete: allCached.isComplete,
      });
    }
  }
}

/**
 * Get all cached items across all regions (for summary generation)
 */
export function getAllCachedNews(): NewsItem[] {
  const cache = getCache();

  // First try the 'all' region cache
  const allCached = cache.get('all');
  if (allCached && allCached.items.length > 0) {
    return allCached.items;
  }

  // Fallback: merge all regional caches
  const allItems = new Map<string, NewsItem>();

  for (const cached of cache.values()) {
    for (const item of cached.items) {
      allItems.set(item.id, item);
    }
  }

  return Array.from(allItems.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

/**
 * Clear cache for a specific key or all cache
 */
export function clearNewsCache(cacheKey?: string): void {
  const cache = getCache();
  if (cacheKey) {
    cache.delete(cacheKey);
  } else {
    cache.clear();
  }
}

/**
 * Get cache stats for diagnostics
 */
export function getCacheStats(): {
  regions: string[];
  totalItems: number;
  oldestAge: number;
} {
  const cache = getCache();
  const regions: string[] = [];
  let totalItems = 0;
  let oldestTimestamp = Date.now();

  for (const [region, cached] of cache.entries()) {
    regions.push(region);
    totalItems += cached.items.length;
    if (cached.timestamp < oldestTimestamp) {
      oldestTimestamp = cached.timestamp;
    }
  }

  return {
    regions,
    totalItems,
    oldestAge: Date.now() - oldestTimestamp,
  };
}
