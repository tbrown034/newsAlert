import { NextResponse } from 'next/server';
import { getCachedNews, getAllCachedNews } from '@/lib/newsCache';
import { generateSummary, getCachedSummary, cacheSummary, canRequestSummary } from '@/lib/aiSummary';
import { regionDisplayNames } from '@/lib/regionDetection';
import { WatchpointId } from '@/types';

// Valid regions for validation
const VALID_REGIONS: WatchpointId[] = ['all', 'us', 'latam', 'middle-east', 'europe-russia', 'asia', 'seismic'];

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for AI generation (requires Vercel Pro)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionParam = searchParams.get('region') || 'all';
  const hours = Math.min(Math.max(1, parseInt(searchParams.get('hours') || '4', 10)), 24);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Validate region parameter
  if (!VALID_REGIONS.includes(regionParam as WatchpointId)) {
    return NextResponse.json(
      { error: 'Invalid region parameter' },
      { status: 400 }
    );
  }
  const region = regionParam as WatchpointId;

  // Rate limiting - prevent expensive API abuse
  if (forceRefresh && !canRequestSummary(region)) {
    return NextResponse.json(
      { error: 'Rate limited. Please wait 60 seconds between refresh requests.' },
      { status: 429 }
    );
  }

  try {
    // Check summary cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedSummary(region);
      if (cached) {
        return NextResponse.json({
          ...cached,
          fromCache: true,
        });
      }
    }

    // Get posts from the NEWS CACHE instead of re-fetching
    // This is the key fix - we use cached news data
    let allPosts;

    if (region === 'all') {
      // Get all cached news across all regions
      allPosts = getAllCachedNews();
    } else {
      // Get cached news for specific region
      const cachedNews = getCachedNews(region);
      if (cachedNews) {
        allPosts = cachedNews.items;
      } else {
        // Fallback: check all cached news and filter by region
        allPosts = getAllCachedNews().filter(post =>
          post.region === region || post.region === 'all'
        );
      }
    }

    // If no cached news available, return a minimal response (not an error)
    // The client can retry as more data loads
    if (!allPosts || allPosts.length === 0) {
      return NextResponse.json({
        region,
        timeWindowHours: hours,
        generatedAt: new Date().toISOString(),
        summary: 'Waiting for news data to load...',
        tensionScore: 3,
        keyDevelopments: [],
        watchIndicators: [],
        sourcesAnalyzed: 0,
        topSources: [],
        fromCache: false,
        pending: true, // Signal to client that more data is coming
      });
    }

    // Filter by time window
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const filteredPosts = allPosts.filter(post => {
      // Time filter
      if (post.timestamp < cutoffTime) return false;

      // Region filter (already applied for non-all regions above, but double-check)
      if (region !== 'all' && post.region !== region && post.region !== 'all') return false;

      return true;
    });

    // Sort by timestamp (newest first) and limit
    const sortedPosts = filteredPosts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50); // Limit to 50 most recent for context window

    // If very few posts, still generate a summary but note it's limited
    // This allows briefings to appear quickly with whatever data is available
    if (sortedPosts.length < 3) {
      // With 1-2 posts, generate a quick summary without AI
      const quickSummary = sortedPosts.length === 0
        ? `No recent activity in ${regionDisplayNames[region]} in the past ${hours} hours.`
        : sortedPosts.length === 1
          ? `One update from ${sortedPosts[0].source.name}: ${sortedPosts[0].title.slice(0, 150)}...`
          : `${sortedPosts.length} updates in the past ${hours} hours. Latest from ${sortedPosts[0].source.name}.`;

      return NextResponse.json({
        region,
        timeWindowHours: hours,
        generatedAt: new Date().toISOString(),
        summary: quickSummary,
        tensionScore: 2,
        keyDevelopments: [],
        watchIndicators: [],
        sourcesAnalyzed: sortedPosts.length,
        topSources: sortedPosts.map(p => p.source.name).slice(0, 3),
        fromCache: false,
        limited: true, // Signal that this is a limited summary
      });
    }

    // Generate summary
    const briefing = await generateSummary(sortedPosts, region, hours);

    // Cache the result
    cacheSummary(briefing);

    return NextResponse.json({
      ...briefing,
      fromCache: false,
    });
  } catch (error) {
    console.error('Summary generation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
