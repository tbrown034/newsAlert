'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WatchpointId } from '@/types';
import { regionDisplayNames } from '@/lib/regionDetection';
import { SparklesIcon } from '@heroicons/react/24/outline';

// Client-side cache - persists across region switches
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes minimum between API calls per region
const briefingCache = new Map<string, { data: BriefingData; cachedAt: number }>();

function getCachedBriefing(region: WatchpointId): BriefingData | null {
  const cached = briefingCache.get(region);
  if (!cached) return null;

  const age = Date.now() - cached.cachedAt;
  if (age > CACHE_TTL_MS) {
    briefingCache.delete(region);
    return null;
  }

  return cached.data;
}

function setCachedBriefing(region: WatchpointId, data: BriefingData): void {
  briefingCache.set(region, { data, cachedAt: Date.now() });
}

interface BriefingData {
  region: WatchpointId;
  timeWindowHours: number;
  generatedAt: string;
  summary: string;
  tensionScore?: number;
  sourcesAnalyzed: number;
  topSources: string[];
  fromCache?: boolean;
  pending?: boolean; // Data still loading
  limited?: boolean; // Only partial data available
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: number;
  };
}

interface InlineBriefingProps {
  region: WatchpointId;
}

// Tension level styling - Light theme
function getTensionStyle(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 8) return { label: 'CRITICAL', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  if (score >= 6) return { label: 'HIGH', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
  if (score >= 4) return { label: 'ELEVATED', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' };
  if (score >= 2) return { label: 'WATCHFUL', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
  return { label: 'STABLE', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
}

export function InlineBriefing({ region }: InlineBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasRequested, setHasRequested] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchBriefing = useCallback(async (isRetry = false) => {
    // Check client-side cache first
    const cached = getCachedBriefing(region);
    if (cached && !isRetry) {
      console.log(`[InlineBriefing] Using cached briefing for ${region}`);
      setBriefing({ ...cached, fromCache: true });
      setLoadTimeMs(0);
      setHasRequested(true);
      return;
    }

    // Abort any previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setLoadTimeMs(null);
    setHasRequested(true);
    const startTime = performance.now();

    try {
      const response = await fetch(`/api/summary?region=${region}&hours=4`, {
        signal: controllerRef.current.signal,
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLoadTimeMs(elapsed);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // 503 means news data isn't ready yet - retry automatically
        if (response.status === 503 && retryCount < 3) {
          console.log(`[InlineBriefing] News not ready, retrying in 2s... (attempt ${retryCount + 1})`);
          setLoading(false);

          // Schedule retry
          retryTimeoutRef.current = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            fetchBriefing(true);
          }, 2000);
          return;
        }

        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[InlineBriefing] Briefing loaded in ${elapsed}ms, ${data.sourcesAnalyzed} sources analyzed`);
      setBriefing(data);

      // Cache the result (only if not pending/limited)
      if (!data.pending && !data.limited) {
        setCachedBriefing(region, data);
      }

      // If data is pending or limited, schedule auto-refresh to get fuller data
      if ((data.pending || data.limited) && retryCount < 5) {
        console.log(`[InlineBriefing] Data incomplete, will refresh in 3s...`);
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchBriefing(true);
        }, 3000);
      } else {
        setRetryCount(0);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      setLoadTimeMs(elapsed);

      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was aborted, don't set state
      }

      console.warn(`[InlineBriefing] Fetch error (${elapsed}ms):`, err);
      setError(err instanceof Error ? err.message : 'Error loading briefing');
    } finally {
      setLoading(false);
    }
  }, [region, retryCount]);

  // Reset state when region changes
  useEffect(() => {
    // Abort any in-flight request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Reset all state
    setHasRequested(false);
    setBriefing(null);
    setError(null);
    setLoading(false);
    setRetryCount(0);
    setLoadTimeMs(null);
  }, [region]);

  // Handle request button click
  const handleRequestBriefing = () => {
    fetchBriefing();
  };

  // Initial state - show button to request briefing
  if (!hasRequested && !briefing) {
    return (
      <div className="mx-3 sm:mx-4 my-3">
        <button
          onClick={handleRequestBriefing}
          className="w-full px-4 py-3 border border-slate-200 dark:border-[#2f3336] rounded-xl bg-slate-50 dark:bg-[#16181c] hover:bg-slate-100 dark:hover:bg-[#1d1f23] hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-center gap-2">
            <SparklesIcon className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-[#e7e9ea]">
              Generate AI Briefing
            </span>
            <span className="text-xs text-slate-400 dark:text-[#71767b]">
              for {regionDisplayNames[region]}
            </span>
          </div>
        </button>
      </div>
    );
  }

  // Loading state - subtle and compact
  if (loading) {
    return (
      <div className="mx-3 sm:mx-4 my-3 px-4 py-3 border border-slate-200 dark:border-[#2f3336] rounded-xl bg-slate-50 dark:bg-[#16181c]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-600 dark:text-[#71767b]">
            {retryCount > 0 ? `Loading briefing (attempt ${retryCount + 1})...` : 'Generating AI briefing...'}
          </span>
        </div>
      </div>
    );
  }

  // Error state - compact with retry
  if (error) {
    return (
      <div className="mx-3 sm:mx-4 my-3 px-4 py-3 border border-amber-200 dark:border-amber-800/50 rounded-xl bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">Briefing unavailable</span>
          </div>
          <button
            onClick={() => fetchBriefing(true)}
            className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state - show button again
  if (!briefing) {
    return (
      <div className="mx-3 sm:mx-4 my-3">
        <button
          onClick={handleRequestBriefing}
          className="w-full px-4 py-3 border border-slate-200 dark:border-[#2f3336] rounded-xl bg-slate-50 dark:bg-[#16181c] hover:bg-slate-100 dark:hover:bg-[#1d1f23] hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-center gap-2">
            <SparklesIcon className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-[#e7e9ea]">
              Generate AI Briefing
            </span>
          </div>
        </button>
      </div>
    );
  }

  const tensionScore = briefing.tensionScore || 5;
  const tension = getTensionStyle(tensionScore);

  return (
    <div className="mx-3 sm:mx-4 my-3 border border-slate-200 dark:border-[#2f3336] rounded-xl overflow-hidden bg-white dark:bg-[#16181c] shadow-sm shadow-slate-200/50 dark:shadow-none news-initial-load">
      {/* Header - Clean and minimal */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#16181c] border-b border-slate-200 dark:border-[#2f3336]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-[#71767b] uppercase tracking-wide">
              AI Summary
            </span>
            <span className="text-xs text-slate-300 dark:text-[#536471]">•</span>
            <span className="text-xs text-slate-500 dark:text-[#71767b]">{regionDisplayNames[region]}</span>
          </div>
          <span className={`px-2 py-0.5 text-2xs font-medium rounded ${tension.bgColor} ${tension.color}`}>
            {tension.label}
          </span>
        </div>
      </div>

      {/* Body - Clean summary only */}
      <div className="px-4 py-3">
        <p className="text-sm text-slate-700 dark:text-[#e7e9ea] leading-relaxed">
          {briefing.summary}
        </p>
      </div>

      {/* Footer - stats with tokens, latency, cost */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-[#16181c] border-t border-slate-100 dark:border-[#2f3336] text-2xs text-slate-400 dark:text-[#536471] flex justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span>{briefing.sourcesAnalyzed} posts</span>
          {(briefing.pending || briefing.limited) && (
            <span className="flex items-center gap-1 text-blue-500">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              updating
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {briefing.fromCache && <span>cached</span>}
          {briefing.usage && (
            <>
              <span>{briefing.usage.inputTokens + briefing.usage.outputTokens} tok</span>
              <span>{briefing.usage.latencyMs > 1000 ? `${(briefing.usage.latencyMs / 1000).toFixed(1)}s` : `${briefing.usage.latencyMs}ms`}</span>
              <span>${briefing.usage.costUsd.toFixed(4)}</span>
            </>
          )}
          {!briefing.usage && loadTimeMs !== null && (
            <span className={loadTimeMs > 10000 ? 'text-amber-500' : ''}>
              {loadTimeMs > 1000 ? `${(loadTimeMs / 1000).toFixed(1)}s` : `${loadTimeMs}ms`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
