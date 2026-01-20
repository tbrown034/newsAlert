import { NewsItem, Source, VerificationStatus } from '@/types';
import { classifyRegion, isBreakingNews } from './sources';
import { createHash } from 'crypto';

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  guid?: string;
}

// Parse RSS XML to items (supports both RSS and Atom formats)
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Try RSS format first (uses <item> tags)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const description = extractTag(itemXml, 'description');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const guid = extractTag(itemXml, 'guid');

    // Link is required, but title can fall back to description (for social media feeds like Bluesky)
    if (link && (title || description)) {
      // Use full content - don't truncate social media posts
      const itemTitle = title || stripHtml(description || '');
      items.push({
        title: decodeHtmlEntities(itemTitle),
        description: decodeHtmlEntities(stripHtml(description || '')),
        link,
        pubDate: pubDate || new Date().toISOString(),
        guid: guid || link,
      });
    }
  }

  // If no RSS items found, try Atom format (uses <entry> tags) - used by Bluesky
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];

      const title = extractTag(entryXml, 'title');
      // Atom uses <content> or <summary> instead of <description>
      const content = extractTag(entryXml, 'content') || extractTag(entryXml, 'summary') || extractTag(entryXml, 'description');
      // Atom uses <link href="..."> attribute instead of <link>text</link>
      const link = extractAtomLink(entryXml);
      // Atom uses <published> or <updated> instead of <pubDate>
      const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
      const guid = extractTag(entryXml, 'id');

      // Link is required, but title can fall back to content (for social media feeds)
      if (link && (title || content)) {
        // Use full content - don't truncate social media posts
        const itemTitle = title || stripHtml(content || '');
        items.push({
          title: decodeHtmlEntities(itemTitle),
          description: decodeHtmlEntities(stripHtml(content || '')),
          link,
          pubDate: pubDate || new Date().toISOString(),
          guid: guid || link,
        });
      }
    }
  }

  return items;
}

// Extract link from Atom format (handles <link href="..."/> attribute)
function extractAtomLink(xml: string): string {
  // First try to get alternate link (preferred for Atom)
  const altLinkMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (altLinkMatch) return altLinkMatch[1];

  // Then try any link with href attribute
  const linkMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (linkMatch) return linkMatch[1];

  // Fallback to regular link tag
  return extractTag(xml, 'link');
}

// Extract content from XML tag
function extractTag(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataRegex = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
    'i'
  );
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#039;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '-',
    '&mdash;': '-',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&hellip;': '...',
  };

  return text
    // Handle hex entities like &#xA; (newline) or &#x27; (apostrophe)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Handle decimal entities like &#039;
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    // Handle named entities
    .replace(/&[a-z]+;/gi, (entity) => entities[entity] || entity);
}

// =============================================================================
// BLUESKY API FETCHING
// =============================================================================
// Bluesky doesn't have native RSS - we use their public API instead

interface BlueskyPost {
  post: {
    uri: string;
    cid: string;
    author: {
      handle: string;
      displayName?: string;
    };
    record: {
      text: string;
      createdAt: string;
    };
    // Embed data is at the post level, not record level
    embed?: {
      $type?: string;
      images?: Array<{
        alt?: string;
        thumb?: string;
      }>;
      external?: {
        uri?: string;
        title?: string;
        description?: string;
      };
      // For video embeds
      playlist?: string;
      thumbnail?: string;
    };
  };
}

interface BlueskyFeedResponse {
  feed: BlueskyPost[];
}

interface BlueskyErrorResponse {
  error: string;
  message?: string;
}

// Cache for invalid Bluesky handles to avoid repeated failed API calls
// Key: handle, Value: { error, timestamp }
const invalidHandleCache = new Map<string, { error: string; timestamp: number }>();
const INVALID_HANDLE_CACHE_TTL = 60 * 60 * 1000; // 1 hour TTL

// Cache for handles that timeout - shorter TTL since it might be transient
const timeoutCache = new Map<string, { count: number; timestamp: number }>();
const TIMEOUT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL
const TIMEOUT_THRESHOLD = 2; // Skip after 2 timeouts

// Extract Bluesky handle from feedUrl (e.g., 'https://bsky.app/profile/bellingcat.com/rss' -> 'bellingcat.com')
function extractBlueskyHandle(feedUrl: string): string | null {
  const match = feedUrl.match(/bsky\.app\/profile\/([^\/]+)/);
  return match ? match[1] : null;
}

// Check if source is a Bluesky source
function isBlueskySource(source: Source & { feedUrl: string }): boolean {
  return source.platform === 'bluesky' || source.feedUrl.includes('bsky.app');
}

// Check if handle is cached as invalid
function isHandleCachedAsInvalid(handle: string): boolean {
  const cached = invalidHandleCache.get(handle);
  if (!cached) return false;

  // Check if cache entry has expired
  if (Date.now() - cached.timestamp > INVALID_HANDLE_CACHE_TTL) {
    invalidHandleCache.delete(handle);
    return false;
  }
  return true;
}

// Check if handle has timed out too many times recently
function isHandleTimedOut(handle: string): boolean {
  const cached = timeoutCache.get(handle);
  if (!cached) return false;

  // Check if cache entry has expired
  if (Date.now() - cached.timestamp > TIMEOUT_CACHE_TTL) {
    timeoutCache.delete(handle);
    return false;
  }
  return cached.count >= TIMEOUT_THRESHOLD;
}

// Record a timeout for a handle
function recordTimeout(handle: string): void {
  const existing = timeoutCache.get(handle);
  const now = Date.now();

  if (existing && (now - existing.timestamp) < TIMEOUT_CACHE_TTL) {
    // Increment existing count
    timeoutCache.set(handle, { count: existing.count + 1, timestamp: now });
  } else {
    // Start fresh count
    timeoutCache.set(handle, { count: 1, timestamp: now });
  }
}

// Fetch posts from Bluesky using their public API
async function fetchBlueskyFeed(source: Source & { feedUrl: string }): Promise<RssItem[]> {
  const handle = extractBlueskyHandle(source.feedUrl);
  if (!handle) {
    console.error(`[Bluesky] Invalid feedUrl format: ${source.feedUrl}`);
    return [];
  }

  // Skip if handle is cached as invalid or has timed out repeatedly
  if (isHandleCachedAsInvalid(handle)) {
    return [];
  }
  if (isHandleTimedOut(handle)) {
    return []; // Silently skip - already logged on previous timeouts
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for faster failure

  try {
    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=20`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle expected errors as return values (not thrown)
      const errorData = await response.json().catch(() => null) as BlueskyErrorResponse | null;
      const errorType = errorData?.error ?? 'UnknownError';
      const errorMessage = errorData?.message ?? 'No message';

      // Handle specific error types
      switch (response.status) {
        case 400:
        case 404:
          // Cache invalid/missing handles to avoid repeated failures
          invalidHandleCache.set(handle, { error: errorType, timestamp: Date.now() });
          console.warn(
            `[Bluesky] ${source.name} (${handle}): ${errorType} - ${errorMessage}. Cached for 1 hour.`
          );
          break;
        case 429:
          // Rate limited - log but don't cache (transient)
          console.warn(`[Bluesky] Rate limited. Consider reducing batch size or adding delays.`);
          break;
        case 401:
        case 403:
          // Auth errors - could indicate API key issues
          console.error(`[Bluesky] Auth error (${response.status}): Check API credentials if using authenticated requests.`);
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors - transient, don't cache
          console.warn(`[Bluesky] ${source.name}: Server error (${response.status}) - service may be temporarily unavailable.`);
          break;
        default:
          console.error(`[Bluesky] ${source.name} (${handle}): HTTP ${response.status} - ${errorType}`);
      }

      return []; // Expected error → return empty result
    }

    const data: BlueskyFeedResponse = await response.json();

    // Handle empty feed gracefully
    if (!data.feed || !Array.isArray(data.feed)) {
      return [];
    }

    return data.feed.map((item) => {
      let text = item.post.record.text;
      const createdAt = item.post.record.createdAt;
      const postId = item.post.uri.split('/').pop() || item.post.cid;
      const link = `https://bsky.app/profile/${item.post.author.handle}/post/${postId}`;
      const embed = item.post.embed;

      // Handle media-only posts (empty text but has embed)
      if (!text || text.trim() === '') {
        if (embed) {
          const embedType = embed.$type || '';
          if (embedType.includes('video')) {
            text = '📹 [Video]';
          } else if (embedType.includes('images') || embed.images?.length) {
            // Try to use image alt text if available
            const altText = embed.images?.[0]?.alt;
            text = altText ? `🖼 ${altText}` : '🖼 [Image]';
          } else if (embed.external?.title) {
            text = embed.external.title;
          } else {
            text = '📎 [Media attachment]';
          }
        } else {
          text = '[No content]';
        }
      }

      return {
        title: text,
        description: text,
        link,
        pubDate: createdAt,
        guid: item.post.uri,
      };
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      // Record timeout and log
      recordTimeout(handle);
      const cached = timeoutCache.get(handle);
      if (cached && cached.count >= TIMEOUT_THRESHOLD) {
        console.warn(`[Bluesky] ${source.name} (${handle}): Timeout #${cached.count} - skipping for 30 min`);
      } else {
        console.warn(`[Bluesky] ${source.name} (${handle}): Request timeout (5s)`);
      }
    } else if (error instanceof Error) {
      console.error(`[Bluesky] ${source.name} (${handle}): ${error.message}`);
    }
    return [];
  }
}

// Get count of cached invalid handles (for diagnostics)
export function getInvalidHandleCacheSize(): number {
  return invalidHandleCache.size;
}

// Get count of timed-out handles (for diagnostics)
export function getTimeoutCacheSize(): number {
  return timeoutCache.size;
}

// Clear invalid handle cache (for testing/maintenance)
export function clearInvalidHandleCache(): void {
  invalidHandleCache.clear();
}

// Clear timeout cache (for testing/maintenance)
export function clearTimeoutCache(): void {
  timeoutCache.clear();
}

// Fetch and parse RSS feed (or Bluesky API for Bluesky sources)
export async function fetchRssFeed(
  source: Source & { feedUrl: string }
): Promise<NewsItem[]> {
  // Use Bluesky API for Bluesky sources (they don't have native RSS)
  if (isBlueskySource(source)) {
    const items = await fetchBlueskyFeed(source);
    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source,
        timestamp: new Date(item.pubDate),
        region,
        verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
        url: item.link,
        alertStatus: null,
        isBreaking: isBreakingNews(item.title, item.description),
      };
    });
  }

  // Standard RSS/Atom fetch for other sources
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(source.feedUrl, {
      signal: controller.signal,
      next: { revalidate: 60 }, // Cache for 1 minute
      headers: {
        'User-Agent': 'newsAlert/1.0 (+https://github.com/newsalert)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`RSS fetch failed for ${source.name}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = parseRssXml(xml);

    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source,
        timestamp: new Date(item.pubDate),
        region,
        verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
        url: item.link,
        alertStatus: null, // Will be set by processAlertStatuses in API
        isBreaking: isBreakingNews(item.title, item.description), // Deprecated, kept for compatibility
      };
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`RSS fetch timeout for ${source.name} (5s exceeded)`);
    } else {
      console.error(`RSS fetch error for ${source.name}:`, error);
    }
    return [];
  }
}

// Determine verification status based on source type and confidence
function getVerificationStatus(
  sourceType: Source['sourceType'],
  confidence: number
): VerificationStatus {
  if (sourceType === 'official' || confidence >= 90) return 'confirmed';
  if (sourceType === 'reporter' || sourceType === 'news-org' || confidence >= 75) return 'multiple-sources';
  return 'unverified';
}

// SHA-256 hash function for generating collision-resistant IDs
function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// Helper to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch multiple RSS feeds with rate limiting for Bluesky
export async function fetchAllRssFeeds(
  sources: (Source & { feedUrl: string })[]
): Promise<NewsItem[]> {
  // Separate Bluesky and RSS sources
  const blueskySources = sources.filter(isBlueskySource);
  const rssSources = sources.filter(s => !isBlueskySource(s));

  // Fetch RSS sources in parallel (no rate limit issues)
  const rssResultsPromise = Promise.allSettled(
    rssSources.map((source) => fetchRssFeed(source))
  );

  // Fetch Bluesky sources in batches to avoid rate limits
  const BLUESKY_BATCH_SIZE = 50; // Larger batches for faster completion
  const BLUESKY_BATCH_DELAY_MS = 50; // Minimal delay between batches
  const blueskyResults: PromiseSettledResult<NewsItem[]>[] = [];

  for (let i = 0; i < blueskySources.length; i += BLUESKY_BATCH_SIZE) {
    const batch = blueskySources.slice(i, i + BLUESKY_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((source) => fetchRssFeed(source))
    );
    blueskyResults.push(...batchResults);

    // Add delay between batches (except for last batch)
    if (i + BLUESKY_BATCH_SIZE < blueskySources.length) {
      await delay(BLUESKY_BATCH_DELAY_MS);
    }
  }

  // Wait for RSS results
  const rssResults = await rssResultsPromise;

  // Combine all results
  const allItems: NewsItem[] = [];
  for (const result of [...rssResults, ...blueskyResults]) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Sort by timestamp, newest first
  return allItems.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}
