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
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
};

// =============================================================================
// POST SELECTION & STRUCTURING
// =============================================================================

interface StructuredPost {
  id: number;
  source: string;
  tier: string;
  minutesAgo: number;
  title: string;
  content?: string;
  contentType: string;
  verification: string;
  provenance: string;
}

/**
 * Smart post selection - prioritize quality over quantity
 * Reduced to 25 posts max to optimize token usage while maintaining coverage
 */
function selectAndStructurePosts(posts: NewsItem[], maxPosts: number = 25): StructuredPost[] {
  const now = Date.now();

  // Score posts for selection
  const scoredPosts = posts.map(post => {
    let score = 0;

    // Tier scoring (official > osint > reporter > ground)
    const tierScores: Record<string, number> = {
      official: 4,
      osint: 3,
      reporter: 2,
      ground: 1,
    };
    score += tierScores[post.source.tier] || 1;

    // Recency scoring (more recent = higher)
    const minutesAgo = Math.floor((now - post.timestamp.getTime()) / 60000);
    if (minutesAgo < 30) score += 3;
    else if (minutesAgo < 60) score += 2;
    else if (minutesAgo < 120) score += 1;

    // Breaking/urgent content
    if (post.isBreaking) score += 2;

    return { post, score, minutesAgo };
  });

  // Sort by score, then by recency
  scoredPosts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.minutesAgo - b.minutesAgo;
  });

  // Deduplicate by similar headlines (simple fuzzy match)
  const selected: typeof scoredPosts = [];
  const seenHeadlines = new Set<string>();

  for (const item of scoredPosts) {
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

    return {
      id: idx + 1,
      source: item.post.source.name,
      tier: item.post.source.tier,
      minutesAgo: item.minutesAgo,
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

  return `You are an intelligence analyst creating a briefing for ${regionName}.

Analyze ${posts.length} posts from the last ${timeWindowHours}h:

<posts>
${postsJson}
</posts>

Post fields: source, tier (official>osint>reporter>ground), minutesAgo, title, contentType, verification, provenance.

Respond with JSON only:
{"summary":"3-4 sentence overview","tensionScore":<1-10>,"keyDevelopments":[{"headline":"<10 words","detail":"1-2 sentences","sources":[],"severity":"critical|high|moderate|routine","confidence":"high|medium|low"}],"watchIndicators":["max 3 escalation signals"]}

Severity: critical=mass casualty/nuclear, high=strikes/invasion, moderate=movements/tensions, routine=statements.
Confidence: high=multiple official sources, medium=single credible, low=unverified/rumor.

Rules: Max 5 developments. Cross-reference sources. Be factual. Score reflects situation severity, not volume.`;
}

// =============================================================================
// API CALL
// =============================================================================

export async function generateSummary(
  posts: NewsItem[],
  region: WatchpointId,
  timeWindowHours: number = 4
): Promise<SituationBriefing> {
  const model = 'claude-sonnet-4-20250514';
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

  // Call Claude API
  const client = new Anthropic();

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const latencyMs = Date.now() - startTime;

  // Extract usage
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;

  // Calculate cost
  const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 };
  const costUsd = (inputTokens * pricing.input / 1_000_000) +
                  (outputTokens * pricing.output / 1_000_000);

  // Parse response
  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Extract JSON from response (handle markdown code blocks if any)
  let jsonStr = textContent.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());

  return {
    region,
    timeWindowHours,
    generatedAt: new Date(),
    summary: parsed.summary,
    tensionScore: parsed.tensionScore || 5,
    keyDevelopments: (parsed.keyDevelopments || []).map((dev: any) => ({
      ...dev,
      confidence: dev.confidence || 'medium',
    })),
    watchIndicators: parsed.watchIndicators || [],
    sourcesAnalyzed: structuredPosts.length,
    topSources,
    usage: {
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      costUsd: Math.round(costUsd * 100000) / 100000, // Round to 5 decimal places
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

export function getCachedSummary(region: WatchpointId): SituationBriefing | null {
  const cached = summaryCache.get(region);
  if (!cached) return null;

  const age = Date.now() - cached.cachedAt.getTime();
  if (age > CACHE_TTL_MS) {
    summaryCache.delete(region);
    return null;
  }

  return cached.briefing;
}

export function cacheSummary(briefing: SituationBriefing): void {
  summaryCache.set(briefing.region, {
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
