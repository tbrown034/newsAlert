import { NewsItem, Source, VerificationStatus, MediaAttachment, ReplyContext, RepostContext } from '@/types';
import { classifyRegion, isBreakingNews } from './sourceUtils';
import { createHash } from 'crypto';

/**
 * Parse a pubDate string into a Date object with timezone normalization.
 *
 * Problem: Many RSS feeds provide timestamps without timezone info, e.g.:
 *   "Mon, 27 Jan 2025 15:32:00" (no timezone suffix)
 *
 * JavaScript's new Date() parses timezone-less strings as LOCAL time of the
 * server running the code. On Vercel (UTC), this is fine. But if a Jerusalem
 * Post article was published at 15:32 IST (UTC+2), it gets parsed as 15:32 UTC,
 * making it appear 2 hours later than reality.
 *
 * Solution: If the parsed date is in the future (within 24h tolerance for
 * timezone drift), clamp it to "now" to avoid confusing "just now" displays.
 */
function parsePubDate(pubDateStr: string): Date {
  // Strip CDATA wrapper if present (e.g., The Diplomat uses this)
  let cleaned = pubDateStr.replace(/<!\[CDATA\[([^\]]*)\]\]>/g, '$1');
  // Normalize the input - trim whitespace and collapse multiple spaces
  const normalized = cleaned.trim().replace(/\s+/g, ' ');

  // Try standard parsing first
  let parsed = new Date(normalized);

  // If standard parsing failed, try custom formats
  if (isNaN(parsed.getTime())) {
    // IAEA format: "26-01-27 13:30" (YY-MM-DD HH:MM)
    const iaeaMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (iaeaMatch) {
      const [, yy, mm, dd, hh, min] = iaeaMatch;
      // Assume 20xx for 2-digit years
      const year = 2000 + parseInt(yy, 10);
      parsed = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10), parseInt(hh, 10), parseInt(min, 10));
    }

    // European timezone abbreviations: "29 Jan 2026 10:45:00 CET"
    // Replace timezone abbreviations with offsets
    // Note: Order matters - longer abbreviations first to avoid partial matches (WEST before WET)
    if (isNaN(parsed.getTime())) {
      const tzMap: [string, string][] = [
        ['CEST', '+0200'], ['EEST', '+0300'], ['WEST', '+0100'],  // Longer first
        ['CET', '+0100'], ['EET', '+0200'], ['WET', '+0000'],
        ['GMT', '+0000'], ['UTC', '+0000'],
        ['EDT', '-0400'], ['CDT', '-0500'], ['MDT', '-0600'], ['PDT', '-0700'],
        ['EST', '-0500'], ['CST', '-0600'], ['MST', '-0700'], ['PST', '-0800'],
      ];
      let converted = normalized;
      for (const [abbr, offset] of tzMap) {
        // Use word boundary to prevent partial matches (e.g., "WET" in "WEST")
        const regex = new RegExp(`\\b${abbr}\\b`);
        if (regex.test(converted)) {
          converted = converted.replace(regex, offset);
          break;
        }
      }
      parsed = new Date(converted);
    }
  }

  // If still failed, return current time (logged for debugging)
  if (isNaN(parsed.getTime())) {
    console.warn(`[RSS] Failed to parse date: "${pubDateStr}"`);
    return new Date();
  }

  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();

  // If the timestamp is in the future (up to 24 hours ahead due to timezone issues),
  // clamp it to current time. This handles feeds with timezone problems gracefully.
  // We allow up to 24h because that's the maximum timezone offset (+14 to -12 = 26h range)
  if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
    return now;
  }

  // If it's more than 24h in the future, something is very wrong - use current time
  if (diffMs > 24 * 60 * 60 * 1000) {
    console.warn(`[RSS] Timestamp far in future (${pubDateStr}), using current time`);
    return now;
  }

  return parsed;
}

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  guid?: string;
  // Extended fields for social media posts
  media?: MediaAttachment[];
  replyContext?: ReplyContext;
  repostContext?: RepostContext;
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
// TELEGRAM WEB PREVIEW FETCHING
// =============================================================================
// Telegram doesn't have a public API - we scrape t.me/s/{channel} web preview

interface TelegramFeedResult {
  items: RssItem[];
  channelAvatar?: string;
}

// Cache for invalid Telegram handles
const invalidTelegramCache = new Map<string, { error: string; timestamp: number }>();
const INVALID_TELEGRAM_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Extract Telegram handle from feedUrl (e.g., 'https://t.me/s/DeepStateUA' -> 'DeepStateUA')
function extractTelegramHandle(feedUrl: string): string | null {
  // Match t.me/s/channel or t.me/channel
  const match = feedUrl.match(/t\.me\/(?:s\/)?([^\/\?]+)/);
  return match ? match[1] : null;
}

// Check if source is a Telegram source
function isTelegramSource(source: Source & { feedUrl: string }): boolean {
  return source.platform === 'telegram' || source.feedUrl.includes('t.me/');
}

// Check if Telegram handle is cached as invalid
function isTelegramHandleCachedAsInvalid(handle: string): boolean {
  const cached = invalidTelegramCache.get(handle);
  if (!cached) return false;
  if (Date.now() - cached.timestamp > INVALID_TELEGRAM_CACHE_TTL) {
    invalidTelegramCache.delete(handle);
    return false;
  }
  return true;
}

// Parse Telegram HTML to extract messages
function parseTelegramHtml(html: string, handle: string): TelegramFeedResult {
  const items: RssItem[] = [];

  // Extract channel avatar from the page header (use [\s\S] instead of /s flag for compatibility)
  const avatarMatch = html.match(/tgme_page_photo_image[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
  const channelAvatar = avatarMatch?.[1];

  // Find all message blocks using data-post attribute
  const messageRegex = /data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?datetime="([^"]+)"/g;

  let match;
  while ((match = messageRegex.exec(html)) !== null) {
    const [, postId, rawText, datetime] = match;

    // Strip HTML tags and decode entities
    let text = rawText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();

    // Skip empty messages
    if (!text) continue;

    // Extract message number from postId (e.g., "DeepStateUA/23100" -> "23100")
    const messageNum = postId.split('/').pop() || '';
    const link = `https://t.me/${handle}/${messageNum}`;

    items.push({
      title: text.slice(0, 500), // Telegram messages can be long
      description: text,
      link,
      pubDate: datetime,
      guid: `telegram-${postId}`,
    });
  }

  return { items, channelAvatar };
}

// Fetch posts from Telegram using web preview
async function fetchTelegramFeed(source: Source & { feedUrl: string }): Promise<TelegramFeedResult> {
  const handle = extractTelegramHandle(source.feedUrl);
  if (!handle) {
    console.error(`[Telegram] Invalid feedUrl format: ${source.feedUrl}`);
    return { items: [] };
  }

  // Skip if handle is cached as invalid
  if (isTelegramHandleCachedAsInvalid(handle)) {
    return { items: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout (Telegram can be slow)

  try {
    // Use the /s/ (static) version which doesn't require JS
    const webUrl = `https://t.me/s/${handle}`;
    const response = await fetch(webUrl, {
      signal: controller.signal,
      headers: {
        // Telegram requires a browser-like User-Agent
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        invalidTelegramCache.set(handle, { error: 'NotFound', timestamp: Date.now() });
        console.warn(`[Telegram] Channel @${handle} not found. Cached for 1 hour.`);
      } else {
        console.error(`[Telegram] ${source.name} (@${handle}): HTTP ${response.status}`);
      }
      return { items: [] };
    }

    const html = await response.text();

    // Check if channel exists (404 pages still return 200 with specific content)
    if (html.includes('tgme_page_context_bot') || html.includes('If you have <strong>Telegram</strong>')) {
      invalidTelegramCache.set(handle, { error: 'PrivateOrNotFound', timestamp: Date.now() });
      console.warn(`[Telegram] Channel @${handle} is private or doesn't exist. Cached for 1 hour.`);
      return { items: [] };
    }

    return parseTelegramHtml(html, handle);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Telegram] ${source.name} (@${handle}): Request timeout (8s)`);
    } else if (error instanceof Error) {
      console.error(`[Telegram] ${source.name} (@${handle}): ${error.message}`);
    }
    return { items: [] };
  }
}

// Get count of cached invalid Telegram handles (for diagnostics)
export function getInvalidTelegramCacheSize(): number {
  return invalidTelegramCache.size;
}

// Clear invalid Telegram cache (for testing/maintenance)
export function clearInvalidTelegramCache(): void {
  invalidTelegramCache.clear();
}

// =============================================================================
// MASTODON API FETCHING
// =============================================================================
// Mastodon has a public API - no auth needed for public posts

interface MastodonStatus {
  id: string;
  created_at: string;
  content: string; // HTML content
  url: string;
  account: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
    url: string;
  };
  media_attachments?: Array<{
    type: 'image' | 'video' | 'gifv' | 'audio';
    url: string;
    preview_url?: string;
    description?: string;
  }>;
  reblog?: MastodonStatus; // Boosted post
  in_reply_to_id?: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
}

interface MastodonFeedResult {
  items: RssItem[];
  authorAvatar?: string;
}

// Cache for invalid Mastodon handles
const invalidMastodonCache = new Map<string, { error: string; timestamp: number }>();
const INVALID_MASTODON_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Extract Mastodon handle and instance from feedUrl
// Formats: https://mastodon.online/@bendobrown or @bendobrown@mastodon.online
function extractMastodonInfo(feedUrl: string): { handle: string; instance: string } | null {
  // Format: https://instance/@handle
  const urlMatch = feedUrl.match(/https?:\/\/([^\/]+)\/@([^\/\?]+)/);
  if (urlMatch) {
    return { instance: urlMatch[1], handle: urlMatch[2] };
  }
  // Format: @handle@instance
  const handleMatch = feedUrl.match(/@?([^@]+)@([^\/\s]+)/);
  if (handleMatch) {
    return { handle: handleMatch[1], instance: handleMatch[2] };
  }
  return null;
}

// Check if source is a Mastodon source
function isMastodonSource(source: Source & { feedUrl: string }): boolean {
  return source.platform === 'mastodon';
}

// Check if Mastodon handle is cached as invalid
function isMastodonHandleCachedAsInvalid(handle: string, instance: string): boolean {
  const key = `${handle}@${instance}`;
  const cached = invalidMastodonCache.get(key);
  if (!cached) return false;
  if (Date.now() - cached.timestamp > INVALID_MASTODON_CACHE_TTL) {
    invalidMastodonCache.delete(key);
    return false;
  }
  return true;
}

// Strip HTML tags from Mastodon content
function stripMastodonHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Fetch posts from Mastodon using public API
async function fetchMastodonFeed(source: Source & { feedUrl: string }): Promise<MastodonFeedResult> {
  const info = extractMastodonInfo(source.feedUrl);
  if (!info) {
    console.error(`[Mastodon] Invalid feedUrl format: ${source.feedUrl}`);
    return { items: [] };
  }

  const { handle, instance } = info;
  const cacheKey = `${handle}@${instance}`;

  // Skip if handle is cached as invalid
  if (isMastodonHandleCachedAsInvalid(handle, instance)) {
    return { items: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // First, look up the account ID by handle
    const lookupUrl = `https://${instance}/api/v1/accounts/lookup?acct=${handle}`;
    const lookupResponse = await fetch(lookupUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!lookupResponse.ok) {
      if (lookupResponse.status === 404) {
        invalidMastodonCache.set(cacheKey, { error: 'NotFound', timestamp: Date.now() });
        console.warn(`[Mastodon] Account @${handle}@${instance} not found. Cached for 1 hour.`);
      } else {
        console.error(`[Mastodon] ${source.name}: Lookup failed with HTTP ${lookupResponse.status}`);
      }
      clearTimeout(timeoutId);
      return { items: [] };
    }

    const account = await lookupResponse.json();
    const accountId = account.id;
    const authorAvatar = account.avatar;

    // Now fetch the account's statuses
    const statusesUrl = `https://${instance}/api/v1/accounts/${accountId}/statuses?limit=20&exclude_replies=true`;
    const statusesResponse = await fetch(statusesUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!statusesResponse.ok) {
      console.error(`[Mastodon] ${source.name}: Statuses fetch failed with HTTP ${statusesResponse.status}`);
      return { items: [] };
    }

    const statuses: MastodonStatus[] = await statusesResponse.json();

    const items: RssItem[] = statuses
      .filter(status => status.visibility === 'public' || status.visibility === 'unlisted')
      .map(status => {
        // Handle boosts (reblogs)
        const content = status.reblog || status;
        const text = stripMastodonHtml(content.content);

        // Extract media attachments
        const media: MediaAttachment[] = (content.media_attachments || []).map(att => ({
          type: att.type === 'video' || att.type === 'gifv' ? 'video' : 'image',
          url: att.url,
          thumbnail: att.preview_url,
          alt: att.description,
        }));

        return {
          title: text.slice(0, 500),
          description: text,
          link: status.url,
          pubDate: status.created_at,
          guid: status.id,
          media: media.length > 0 ? media : undefined,
          repostContext: status.reblog ? {
            originalAuthor: status.reblog.account.display_name || status.reblog.account.username,
            originalHandle: `${status.reblog.account.username}@${new URL(status.reblog.account.url).hostname}`,
          } : undefined,
        };
      });

    return { items, authorAvatar };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Mastodon] ${source.name} (@${handle}@${instance}): Request timeout (8s)`);
    } else if (error instanceof Error) {
      console.error(`[Mastodon] ${source.name} (@${handle}@${instance}): ${error.message}`);
    }
    return { items: [] };
  }
}

// Get count of cached invalid Mastodon handles (for diagnostics)
export function getInvalidMastodonCacheSize(): number {
  return invalidMastodonCache.size;
}

// Clear invalid Mastodon cache (for testing/maintenance)
export function clearInvalidMastodonCache(): void {
  invalidMastodonCache.clear();
}

// =============================================================================
// REDDIT JSON FETCHING
// =============================================================================
// Reddit has public JSON API - append .json to any URL

interface RedditPost {
  kind: string;
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    url: string;
    permalink: string;
    created_utc: number;
    score: number;
    num_comments: number;
    subreddit: string;
    stickied?: boolean;
    link_flair_text?: string;
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source: { url: string; width: number; height: number };
        resolutions?: Array<{ url: string; width: number; height: number }>;
      }>;
    };
    is_video?: boolean;
    media?: {
      reddit_video?: {
        fallback_url: string;
        duration: number;
      };
    };
  };
}

interface RedditListing {
  kind: string;
  data: {
    children: RedditPost[];
    after?: string;
  };
}

interface RedditFeedResult {
  items: RssItem[];
  subredditIcon?: string;
}

// Cache for invalid Reddit subreddits
const invalidRedditCache = new Map<string, { error: string; timestamp: number }>();
const INVALID_REDDIT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Minimum upvote threshold for quality filtering
const REDDIT_MIN_SCORE = 100;

// Megathread detection patterns (case-insensitive)
const MEGATHREAD_PATTERNS = [
  /live\s*thread/i,
  /megathread/i,
  /\[live\]/i,
  /breaking:/i,
  /developing:/i,
];

// Extract subreddit from feedUrl
function extractSubreddit(feedUrl: string): string | null {
  const match = feedUrl.match(/reddit\.com\/r\/([^\/\?\s]+)/i);
  return match ? match[1] : null;
}

// Check if source is a Reddit source
function isRedditSource(source: Source & { feedUrl: string }): boolean {
  return source.platform === 'reddit' || source.feedUrl.includes('reddit.com/r/');
}

// Check if Reddit subreddit is cached as invalid
function isRedditSubredditCachedAsInvalid(subreddit: string): boolean {
  const cached = invalidRedditCache.get(subreddit);
  if (!cached) return false;
  if (Date.now() - cached.timestamp > INVALID_REDDIT_CACHE_TTL) {
    invalidRedditCache.delete(subreddit);
    return false;
  }
  return true;
}

// Decode Reddit's HTML-encoded URLs (they encode & as &amp;)
function decodeRedditUrl(url: string): string {
  return url.replace(/&amp;/g, '&');
}

// Fetch posts from Reddit using JSON API (megathreads only)
async function fetchRedditFeed(source: Source & { feedUrl: string }): Promise<RedditFeedResult> {
  const subreddit = extractSubreddit(source.feedUrl);
  if (!subreddit) {
    console.error(`[Reddit] Invalid feedUrl format: ${source.feedUrl}`);
    return { items: [] };
  }

  // Skip if subreddit is cached as invalid
  if (isRedditSubredditCachedAsInvalid(subreddit)) {
    return { items: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for Reddit

  try {
    const jsonUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`;
    const response = await fetch(jsonUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PulseAlert/1.0)',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        invalidRedditCache.set(subreddit, { error: 'NotFoundOrPrivate', timestamp: Date.now() });
        console.warn(`[Reddit] Subreddit r/${subreddit} not found or private. Cached for 1 hour.`);
      } else if (response.status === 429) {
        console.warn(`[Reddit] Rate limited. Consider reducing request frequency.`);
      } else {
        console.error(`[Reddit] ${source.name}: HTTP ${response.status}`);
      }
      return { items: [] };
    }

    const listing: RedditListing = await response.json();

    // Check if post is a megathread (stickied or matches pattern)
    const isMegathread = (post: RedditPost): boolean => {
      const title = post.data.title;
      const isStickied = post.data.stickied === true;
      const matchesPattern = MEGATHREAD_PATTERNS.some(pattern => pattern.test(title));
      return isStickied || matchesPattern;
    };

    // Only show megathreads from news subreddits (skip regular posts)
    const megathreads = listing.data.children.filter(post => isMegathread(post));

    const items: RssItem[] = megathreads
      .map(post => {
        const data = post.data;
        const link = `https://www.reddit.com${data.permalink}`;

        // Build title with subreddit prefix
        const title = data.title;

        // For link posts, use the external URL; for self posts, use Reddit link
        const externalUrl = data.url && !data.url.includes('reddit.com') ? data.url : link;

        // Extract thumbnail/preview image
        const media: MediaAttachment[] = [];

        if (data.preview?.images?.[0]) {
          const preview = data.preview.images[0];
          // Use medium resolution if available, otherwise source
          const imageUrl = preview.resolutions?.find(r => r.width >= 320)?.url || preview.source.url;
          media.push({
            type: 'image',
            url: decodeRedditUrl(preview.source.url),
            thumbnail: decodeRedditUrl(imageUrl),
            alt: data.title,
          });
        } else if (data.is_video && data.media?.reddit_video) {
          media.push({
            type: 'video',
            url: data.media.reddit_video.fallback_url,
            thumbnail: data.thumbnail && data.thumbnail !== 'self' ? data.thumbnail : undefined,
          });
        } else if (data.thumbnail && !['self', 'default', 'nsfw', 'spoiler'].includes(data.thumbnail)) {
          media.push({
            type: 'image',
            url: data.thumbnail,
            thumbnail: data.thumbnail,
            alt: data.title,
          });
        }

        // Build description with score and comments
        const description = data.selftext
          ? data.selftext.slice(0, 500)
          : `${data.score.toLocaleString()} upvotes | ${data.num_comments.toLocaleString()} comments`;

        return {
          title,
          description,
          link: externalUrl,
          pubDate: new Date(data.created_utc * 1000).toISOString(),
          guid: `reddit-${data.id}`,
          media: media.length > 0 ? media : undefined,
        };
      });

    return { items };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Reddit] ${source.name} (r/${subreddit}): Request timeout (10s)`);
    } else if (error instanceof Error) {
      console.error(`[Reddit] ${source.name} (r/${subreddit}): ${error.message}`);
    }
    return { items: [] };
  }
}

// Get count of cached invalid Reddit subreddits (for diagnostics)
export function getInvalidRedditCacheSize(): number {
  return invalidRedditCache.size;
}

// Clear invalid Reddit cache (for testing/maintenance)
export function clearInvalidRedditCache(): void {
  invalidRedditCache.clear();
}

// =============================================================================
// YOUTUBE RSS HANDLING
// =============================================================================
// YouTube has native RSS feeds but needs special handling for thumbnails

// Check if source is a YouTube source
function isYouTubeSource(source: Source & { feedUrl: string }): boolean {
  return source.platform === 'youtube' || source.feedUrl.includes('youtube.com/feeds/');
}

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  // Format: yt:video:VIDEO_ID (from RSS guid)
  const ytMatch = url.match(/yt:video:([a-zA-Z0-9_-]+)/);
  if (ytMatch) return ytMatch[1];

  // Format: youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (watchMatch) return watchMatch[1];

  // Format: youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  return null;
}

// Get YouTube thumbnail URL from video ID
function getYouTubeThumbnail(videoId: string): string {
  // mqdefault is 320x180 (16:9 aspect ratio)
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

// Extract media:group content from YouTube RSS entry
function extractYouTubeMedia(xml: string): { thumbnail?: string; duration?: number } {
  const result: { thumbnail?: string; duration?: number } = {};

  // Extract media:thumbnail
  const thumbMatch = xml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
  if (thumbMatch) {
    result.thumbnail = thumbMatch[1];
  }

  // Extract duration from media:content (in seconds)
  const durationMatch = xml.match(/<media:content[^>]*duration=["'](\d+)["']/i);
  if (durationMatch) {
    result.duration = parseInt(durationMatch[1], 10);
  }

  return result;
}

// Format duration in seconds to MM:SS or HH:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      avatar?: string;
    };
    record: {
      text: string;
      createdAt: string;
      // Reply reference (if this post is a reply)
      reply?: {
        parent: { uri: string; cid: string };
        root: { uri: string; cid: string };
      };
    };
    // Embed data is at the post level, not record level
    embed?: {
      $type?: string;
      images?: Array<{
        alt?: string;
        thumb?: string;
        fullsize?: string;
      }>;
      external?: {
        uri?: string;
        title?: string;
        description?: string;
        thumb?: string;
      };
      // For video embeds
      playlist?: string;
      thumbnail?: string;
      // For quote posts (record with media)
      record?: {
        author?: { handle: string; displayName?: string };
        value?: { text?: string };
      };
      media?: {
        images?: Array<{ alt?: string; thumb?: string; fullsize?: string }>;
      };
    };
  };
  // Reply thread context (parent/root post details)
  reply?: {
    parent?: {
      post?: {
        author: { handle: string; displayName?: string };
        record?: { text?: string };
      };
    };
    root?: {
      post?: {
        author: { handle: string; displayName?: string };
      };
    };
  };
  // Reason for this feed item (e.g., repost)
  reason?: {
    $type: string;
    by?: {
      handle: string;
      displayName?: string;
    };
    indexedAt?: string;
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

// Result type for Bluesky feed with avatar
interface BlueskyFeedResult {
  items: RssItem[];
  authorAvatar?: string;
}

// Fetch posts from Bluesky using their public API
async function fetchBlueskyFeed(source: Source & { feedUrl: string }): Promise<BlueskyFeedResult> {
  const handle = extractBlueskyHandle(source.feedUrl);
  if (!handle) {
    console.error(`[Bluesky] Invalid feedUrl format: ${source.feedUrl}`);
    return { items: [] };
  }

  // Skip if handle is cached as invalid or has timed out repeatedly
  if (isHandleCachedAsInvalid(handle)) {
    return { items: [] };
  }
  if (isHandleTimedOut(handle)) {
    return { items: [] }; // Silently skip - already logged on previous timeouts
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for faster failure

  try {
    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=10&filter=posts_no_replies`;
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

      return { items: [] }; // Expected error → return empty result
    }

    const data: BlueskyFeedResponse = await response.json();

    // Handle empty feed gracefully
    if (!data.feed || !Array.isArray(data.feed)) {
      return { items: [] };
    }

    // Extract author avatar from first post (all posts in author feed are from same author)
    const authorAvatar = data.feed[0]?.post.author.avatar;

    const items = data.feed.map((item) => {
      let text = item.post.record.text;
      const createdAt = item.post.record.createdAt;
      const postId = item.post.uri.split('/').pop() || item.post.cid;
      const link = `https://bsky.app/profile/${item.post.author.handle}/post/${postId}`;
      const embed = item.post.embed;

      // Extract media attachments
      const media: MediaAttachment[] = [];

      if (embed) {
        const embedType = embed.$type || '';

        // Handle images
        const images = embed.images || embed.media?.images;
        if (images?.length) {
          for (const img of images) {
            media.push({
              type: 'image',
              url: img.fullsize || img.thumb || '',
              thumbnail: img.thumb,
              alt: img.alt,
            });
          }
        }

        // Handle video
        if (embedType.includes('video') && embed.thumbnail) {
          media.push({
            type: 'video',
            url: embed.playlist || link, // Link to post if no direct video URL
            thumbnail: embed.thumbnail,
          });
        }

        // Handle external links (cards)
        if (embed.external?.uri) {
          media.push({
            type: 'external',
            url: embed.external.uri,
            thumbnail: embed.external.thumb,
            title: embed.external.title,
            alt: embed.external.description,
          });
        }
      }

      // Extract reply context
      // Bluesky provides reply info in two places:
      // 1. item.reply - Thread context with parent/root post details (may include text)
      // 2. item.post.record.reply - Just URI references (indicates this IS a reply)
      let replyContext: ReplyContext | undefined;
      if (item.reply?.parent?.post) {
        const parentPost = item.reply.parent.post;
        replyContext = {
          parentAuthor: parentPost.author.displayName || parentPost.author.handle,
          parentHandle: parentPost.author.handle,
          parentText: parentPost.record?.text?.slice(0, 100), // Truncate parent text
        };
      } else if (item.post.record.reply) {
        // Post is a reply but we don't have parent details - mark as reply anyway
        // This helps users understand why a short post like "Exactly" exists
        replyContext = {
          parentAuthor: 'someone',
          parentHandle: undefined,
          parentText: undefined,
        };
      }

      // Extract repost context
      let repostContext: RepostContext | undefined;
      if (item.reason?.$type === 'app.bsky.feed.defs#reasonRepost' && item.reason.by) {
        repostContext = {
          originalAuthor: item.reason.by.displayName || item.reason.by.handle,
          originalHandle: item.reason.by.handle,
        };
      }

      // Handle media-only posts (empty text but has embed)
      if (!text || text.trim() === '') {
        if (embed) {
          const embedType = embed.$type || '';
          if (embedType.includes('video')) {
            text = '[Video]';
          } else if (embedType.includes('images') || embed.images?.length) {
            const altText = embed.images?.[0]?.alt;
            text = altText || '[Image]';
          } else if (embed.external?.title) {
            text = embed.external.title;
          } else {
            text = '[Media attachment]';
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
        media: media.length > 0 ? media : undefined,
        replyContext,
        repostContext,
      };
    });

    return { items, authorAvatar };
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
    return { items: [] };
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

// Extract domain from URL for favicon generation
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

// Generate favicon URL for a domain
function getFaviconUrl(domain: string): string {
  return `https://icon.horse/icon/${domain}`;
}

// Fetch and parse RSS feed (or platform-specific API for Bluesky/Telegram)
export async function fetchRssFeed(
  source: Source & { feedUrl: string }
): Promise<NewsItem[]> {
  // Use Telegram web scraping for Telegram sources
  if (isTelegramSource(source)) {
    const { items, channelAvatar } = await fetchTelegramFeed(source);

    const sourceWithAvatar = {
      ...source,
      avatarUrl: channelAvatar,
    };

    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source: sourceWithAvatar,
        timestamp: parsePubDate(item.pubDate),
        region,
        verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
        url: item.link,
        alertStatus: null,
        isBreaking: isBreakingNews(item.title, item.description),
      };
    });
  }

  // Use Mastodon API for Mastodon sources
  if (isMastodonSource(source)) {
    const { items, authorAvatar } = await fetchMastodonFeed(source);

    const sourceWithAvatar = {
      ...source,
      avatarUrl: authorAvatar,
    };

    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source: sourceWithAvatar,
        timestamp: parsePubDate(item.pubDate),
        region,
        verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
        url: item.link,
        alertStatus: null,
        isBreaking: isBreakingNews(item.title, item.description),
        media: item.media,
        repostContext: item.repostContext,
      };
    });
  }

  // Use Reddit JSON API for Reddit sources (megathreads only)
  if (isRedditSource(source)) {
    const { items } = await fetchRedditFeed(source);

    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source,
        timestamp: parsePubDate(item.pubDate),
        region,
        verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
        url: item.link,
        alertStatus: null,
        isBreaking: isBreakingNews(item.title, item.description),
        media: item.media,
      };
    });
  }

  // Use Bluesky API for Bluesky sources (they don't have native RSS)
  if (isBlueskySource(source)) {
    const { items, authorAvatar } = await fetchBlueskyFeed(source);

    // Create source with avatar
    const sourceWithAvatar = {
      ...source,
      avatarUrl: authorAvatar,
    };

    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source: sourceWithAvatar,
        timestamp: parsePubDate(item.pubDate),
        region,
        verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
        url: item.link,
        alertStatus: null,
        isBreaking: isBreakingNews(item.title, item.description),
        // Pass through media and context for Bluesky posts
        media: item.media,
        replyContext: item.replyContext,
        repostContext: item.repostContext,
      };
    });
  }

  // YouTube RSS with thumbnail post-processing
  if (isYouTubeSource(source)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s for YouTube

    try {
      const response = await fetch(source.feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PulseAlert/1.0)',
          'Accept': 'application/atom+xml, application/rss+xml, application/xml',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[YouTube] ${source.name}: HTTP ${response.status}`);
        return [];
      }

      const xml = await response.text();

      // YouTube uses Atom format with entries
      const items: RssItem[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(xml)) !== null) {
        const entryXml = match[1];

        const title = extractTag(entryXml, 'title');
        const link = extractAtomLink(entryXml);
        const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
        const videoId = extractTag(entryXml, 'yt:videoId');
        const description = extractTag(entryXml, 'media:description') || extractTag(entryXml, 'summary');

        // Extract media info
        const mediaInfo = extractYouTubeMedia(entryXml);

        if (link && title && videoId) {
          // Build media attachment with thumbnail
          const media: MediaAttachment[] = [{
            type: 'video',
            url: link,
            thumbnail: mediaInfo.thumbnail || getYouTubeThumbnail(videoId),
            title: title,
            alt: mediaInfo.duration ? `Duration: ${formatDuration(mediaInfo.duration)}` : undefined,
          }];

          items.push({
            title: decodeHtmlEntities(title),
            description: decodeHtmlEntities(description || title),
            link,
            pubDate: pubDate || new Date().toISOString(),
            guid: `youtube-${videoId}`,
            media,
          });
        }
      }

      // Generate favicon for YouTube
      const sourceWithAvatar = {
        ...source,
        avatarUrl: 'https://icon.horse/icon/youtube.com',
      };

      return items.map((item) => {
        const region = source.region !== 'all'
          ? source.region
          : classifyRegion(item.title, item.description);

        return {
          id: `${source.id}-${hashString(item.guid || item.link)}`,
          title: item.title,
          content: item.description || item.title,
          source: sourceWithAvatar,
          timestamp: parsePubDate(item.pubDate),
          region,
          verificationStatus: getVerificationStatus(source.sourceType, source.confidence),
          url: item.link,
          alertStatus: null,
          isBreaking: isBreakingNews(item.title, item.description),
          media: item.media,
        };
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[YouTube] ${source.name}: Request timeout (8s)`);
      } else if (error instanceof Error) {
        console.error(`[YouTube] ${source.name}: ${error.message}`);
      }
      return [];
    }
  }

  // Standard RSS/Atom fetch for other sources
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(source.feedUrl, {
      signal: controller.signal,
      next: { revalidate: 60 }, // Cache for 1 minute
      headers: {
        'User-Agent': 'PulseAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`RSS fetch failed for ${source.name}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = parseRssXml(xml);

    // Generate favicon URL from feed domain
    const domain = extractDomain(source.feedUrl);
    const sourceWithAvatar = {
      ...source,
      avatarUrl: domain ? getFaviconUrl(domain) : undefined,
    };

    return items.map((item) => {
      const region = source.region !== 'all'
        ? source.region
        : classifyRegion(item.title, item.description);

      return {
        id: `${source.id}-${hashString(item.guid || item.link)}`,
        title: item.title,
        content: item.description || item.title,
        source: sourceWithAvatar,
        timestamp: parsePubDate(item.pubDate),
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
