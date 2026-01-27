/**
 * AI SUMMARY GENERATION
 * =====================
 * Generates situation briefings from recent posts using Claude.
 *
 * Pricing (Sonnet 4): $3/1M input, $15/1M output
 * Pricing (Haiku 3.5): $0.80/1M input, $4/1M output
 */

import Anthropic from '@anthropic-ai/sdk';
import { WatchpointId, NewsItem } from '@/types';
import { regionDisplayNames } from './regionDetection';
import { analyzeMessage } from './messageAnalysis';

// =============================================================================
// TYPES
// =============================================================================

export interface KeyDevelopment {
  headline: string;
  detail: string;
  sources: string[];
  severity: 'critical' | 'high' | 'moderate' | 'routine';
  confidence: 'high' | 'medium' | 'low';
}

export interface SituationBriefing {
  region: WatchpointId;
  timeWindowHours: number;
  generatedAt: Date;
  summary: string;
  tensionScore: number; // 1-10 scale
  keyDevelopments: KeyDevelopment[];
  watchIndicators: string[]; // What to watch for escalation
  sourcesAnalyzed: number;
  topSources: string[];
  // Usage metrics
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: number;
  };
}

// Model pricing per 1M tokens
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5-20251101': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
};

// =============================================================================
// POST SELECTION & STRUCTURING
// =============================================================================

interface StructuredPost {
  id: number;
  source: string;
  sourceType: string;
  minutesAgo: number;
  postedAt: string; // Human-readable time (e.g., "2:43 PM")
  title: string;
  content?: string;
  contentType: string;
  verification: string;
  provenance: string;
}

/**
 * Post selection - simple recency-based approach
 * Takes the 25 most recent posts, deduplicating similar headlines
 */
function selectAndStructurePosts(posts: NewsItem[], maxPosts: number = 25): StructuredPost[] {
  const now = Date.now();

  // Sort by recency (newest first)
  const sortedPosts = [...posts]
    .map(post => ({
      post,
      minutesAgo: Math.floor((now - post.timestamp.getTime()) / 60000)
    }))
    .sort((a, b) => a.minutesAgo - b.minutesAgo);

  // Deduplicate by similar headlines (simple fuzzy match)
  const selected: typeof sortedPosts = [];
  const seenHeadlines = new Set<string>();

  for (const item of sortedPosts) {
    // Normalize headline for comparison
    const normalized = item.post.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(w => w.length > 3)
      .slice(0, 5)
      .join(' ');

    // Skip if too similar to existing
    let isDupe = false;
    for (const seen of seenHeadlines) {
      const overlap = normalized.split(' ').filter(w => seen.includes(w)).length;
      if (overlap >= 3) {
        isDupe = true;
        break;
      }
    }

    if (!isDupe) {
      selected.push(item);
      seenHeadlines.add(normalized);
    }

    if (selected.length >= maxPosts) break;
  }

  // Structure posts with analysis (optimized fields for token efficiency)
  return selected.map((item, idx) => {
    const analysis = analyzeMessage(item.post.title + ' ' + (item.post.content || ''));

    // Calculate human-readable posted time
    const postedTime = new Date(now - item.minutesAgo * 60 * 1000);
    const postedAt = postedTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return {
      id: idx + 1,
      source: item.post.source.name,
      sourceType: item.post.source.sourceType,
      minutesAgo: item.minutesAgo,
      postedAt,
      title: item.post.title,
      content: item.post.content !== item.post.title ? item.post.content : undefined,
      contentType: analysis.contentType.type,
      verification: analysis.verification.level,
      provenance: analysis.provenance.type,
    };
  });
}

// =============================================================================
// ENHANCED PROMPT
// =============================================================================

function buildEnhancedPrompt(
  posts: StructuredPost[],
  region: WatchpointId,
  timeWindowHours: number
): string {
  const regionName = regionDisplayNames[region];
  // Use compact JSON to reduce token count (~30% savings)
  const postsJson = JSON.stringify(posts);

  // Temporal grounding - give AI awareness of current time and date
  const now = new Date();
  const startTime = new Date(now.getTime() - timeWindowHours * 60 * 60 * 1000);

  const currentTimeStr = now.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const nowTimeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `You are a news editor writing a brief situation update for ${regionName}.

Current time: ${currentTimeStr}
Window: ${startTimeStr} to ${nowTimeStr} (${timeWindowHours}h)

<posts>
${postsJson}
</posts>

Write a concise briefing in JSON:
{
  "overview": "1-2 sentences. What's the overall picture? Are tensions rising, stable, or easing? Give context.",
  "developments": [
    "Specific event + source (e.g., 'Ukraine reported 49 clashes since dawn - Ukrinform')",
    "Another key development + source",
    "Third if significant, otherwise omit"
  ]
}

Rules:
- Overview = big picture assessment, not a list of events
- Developments = 2-3 specific items with sources, each one line
- Reference time naturally (this morning, overnight, since dawn)
- No jargon, no severity labels, no scores`;
}

// =============================================================================
// API CALL
// =============================================================================

export async function generateSummary(
  posts: NewsItem[],
  region: WatchpointId,
  timeWindowHours: number = 6,
  model: string = 'claude-3-5-haiku-20241022'
): Promise<SituationBriefing> {
  const startTime = Date.now();

  // Validate we have posts
  if (posts.length === 0) {
    return {
      region,
      timeWindowHours,
      generatedAt: new Date(),
      summary: 'No recent posts to analyze for this region.',
      tensionScore: 1,
      keyDevelopments: [],
      watchIndicators: [],
      sourcesAnalyzed: 0,
      topSources: [],
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        costUsd: 0,
      },
    };
  }

  // Select and structure posts
  const structuredPosts = selectAndStructurePosts(posts);

  // Get unique sources
  const sourceCounts = new Map<string, number>();
  for (const post of structuredPosts) {
    const count = sourceCounts.get(post.source) || 0;
    sourceCounts.set(post.source, count + 1);
  }
  const topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Build enhanced prompt
  const prompt = buildEnhancedPrompt(structuredPosts, region, timeWindowHours);

  // Call Claude API with streaming to avoid Vercel timeout
  const client = new Anthropic();

  // Use streaming to keep connection alive (avoids 10s Vercel Hobby timeout)
  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Collect streamed text
  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
    }
  }

  // Get final message for usage stats
  const finalMessage = await stream.finalMessage();
  const latencyMs = Date.now() - startTime;

  // Extract usage
  const inputTokens = finalMessage.usage?.input_tokens || 0;
  const outputTokens = finalMessage.usage?.output_tokens || 0;

  // Calculate cost
  const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 };
  const costUsd = (inputTokens * pricing.input / 1_000_000) +
                  (outputTokens * pricing.output / 1_000_000);

  // Extract JSON from response (handle markdown code blocks if any)
  let jsonStr = fullText;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());

  // Convert developments array to keyDevelopments format for UI
  const developments = parsed.developments || [];
  const keyDevelopments = developments.map((text: string) => ({
    headline: text,
    detail: '',
    sources: [],
    severity: 'moderate' as const,
    confidence: 'medium' as const,
  }));

  return {
    region,
    timeWindowHours,
    generatedAt: new Date(),
    summary: parsed.overview || parsed.summary || '',
    tensionScore: 5,
    keyDevelopments,
    watchIndicators: [],
    sourcesAnalyzed: structuredPosts.length,
    topSources,
    usage: {
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      costUsd: Math.round(costUsd * 100000) / 100000,
    },
  };
}

// =============================================================================
// RATE LIMITING / CACHING
// =============================================================================

// TODO: Implement server-side cron job for pre-generating summaries
// ----------------------------------------------------------------
// Currently summaries are generated on-demand when users request them.
// For better UX (instant load), consider:
// 1. Set up a cron job (Vercel cron, or external scheduler) to run every 5-10 minutes
// 2. Pre-generate summaries for all regions and store in cache (Redis/KV store)
// 3. Client requests would then always hit cache, with fallback to on-demand generation
// 4. Could also use Next.js ISR (Incremental Static Regeneration) for the summary endpoint
//
// Benefits: Instant load times, consistent cost (not user-dependent), background processing
// Considerations: Slightly stale data (up to cron interval), storage costs for KV

interface CachedSummary {
  briefing: SituationBriefing;
  cachedAt: Date;
}

const summaryCache = new Map<string, CachedSummary>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (increased from 5)

// Rate limiting - track last request time per region
const lastRequestTime = new Map<string, number>();
const MIN_REQUEST_INTERVAL_MS = 60 * 1000; // 1 minute between requests per region

export function getCachedSummary(region: WatchpointId, tier: string = 'quick'): SituationBriefing | null {
  const cacheKey = `${region}:${tier}`;
  const cached = summaryCache.get(cacheKey);
  if (!cached) return null;

  const age = Date.now() - cached.cachedAt.getTime();
  if (age > CACHE_TTL_MS) {
    summaryCache.delete(cacheKey);
    return null;
  }

  return cached.briefing;
}

export function cacheSummary(briefing: SituationBriefing, tier: string = 'quick'): void {
  const cacheKey = `${briefing.region}:${tier}`;
  summaryCache.set(cacheKey, {
    briefing,
    cachedAt: new Date(),
  });
  lastRequestTime.set(briefing.region, Date.now());
}

export function canRequestSummary(region: WatchpointId): boolean {
  const lastTime = lastRequestTime.get(region);
  if (!lastTime) return true;
  return Date.now() - lastTime >= MIN_REQUEST_INTERVAL_MS;
}

export function clearSummaryCache(region?: WatchpointId): void {
  if (region) {
    summaryCache.delete(region);
  } else {
    summaryCache.clear();
  }
}
