'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
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

interface KeyDevelopment {
  headline: string;
  detail: string;
  sources: string[];
  severity: 'critical' | 'high' | 'moderate' | 'routine';
  confidence?: 'high' | 'medium' | 'low';
}

interface BriefingData {
  region: WatchpointId;
  timeWindowHours: number;
  generatedAt: string;
  summary: string;
  tensionScore?: number;
  keyDevelopments?: KeyDevelopment[];
  watchIndicators?: string[];
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

// Removed tension/severity styling - keeping it minimal

// Countries/locations to highlight in briefing text
const HIGHLIGHT_LOCATIONS = [
  // Active conflict regions
  'Ukraine', 'Russia', 'Crimea', 'Donbas', 'Kyiv', 'Moscow', 'Kharkiv', 'Odesa',
  'Israel', 'Gaza', 'West Bank', 'Lebanon', 'Beirut', 'Hezbollah', 'Hamas', 'Jerusalem', 'Tel Aviv',
  'Iran', 'Tehran', 'Syria', 'Damascus', 'Yemen', 'Houthi',
  // Asia-Pacific
  'China', 'Taiwan', 'Beijing', 'Taipei', 'North Korea', 'Pyongyang', 'South Korea', 'Seoul',
  'Philippines', 'South China Sea', 'Japan', 'Tokyo',
  // Americas
  'United States', 'U.S.', 'US', 'Washington', 'Mexico', 'Venezuela', 'Cuba',
  // Europe
  'NATO', 'EU', 'European Union', 'Germany', 'France', 'UK', 'Britain', 'Poland', 'Belarus', 'Moldova',
  // Other hotspots
  'Sudan', 'Ethiopia', 'Myanmar', 'Afghanistan', 'Pakistan', 'India', 'Kashmir',
];

// Common news source suffixes - don't highlight locations before these
const SOURCE_SUFFIXES = ['Post', 'Times', 'Monitor', 'Tribune', 'Herald', 'Journal', 'News', 'Today', 'Daily'];

// Highlight locations in text with subtle emphasis
// Skip highlighting when location is part of a source name (e.g., "Jerusalem Post")
function highlightLocations(text: string): React.ReactNode {
  if (!text) return text;

  // Build regex pattern (case insensitive, word boundaries)
  const pattern = new RegExp(
    `\\b(${HIGHLIGHT_LOCATIONS.map(loc => loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );

  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isLocation = HIGHLIGHT_LOCATIONS.some(
      loc => loc.toLowerCase() === part.toLowerCase()
    );
    if (isLocation) {
      // Check if next part starts with a source suffix (e.g., " Post", " Times")
      const nextPart = parts[i + 1];
      if (nextPart) {
        const nextWord = nextPart.trim().split(/\s+/)[0];
        if (SOURCE_SUFFIXES.some(suffix => suffix.toLowerCase() === nextWord.toLowerCase())) {
          // This is part of a source name, don't highlight
          return part;
        }
      }
      return (
        <span key={i} className="font-semibold text-slate-900 dark:text-white">
          {part}
        </span>
      );
    }
    return part;
  });
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
      const response = await fetch(`/api/summary?region=${region}&hours=6`, {
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
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-sm transition-all"
        >
          <SparklesIcon className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-100">
            Generate AI Briefing
          </span>
        </button>
      </div>
    );
  }

  // Loading state - subtle and compact
  if (loading) {
    return (
      <div className="mx-3 sm:mx-4 my-3 px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-600 dark:text-slate-500">
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
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-sm transition-all"
        >
          <SparklesIcon className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-100">
            Generate AI Briefing
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-4 my-3 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      {/* Header - Minimal */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-500">
          {regionDisplayNames[region]} · last {briefing.timeWindowHours}h
        </span>
      </div>

      {/* Body - Overview + Developments */}
      <div className="px-4 py-3 space-y-3">
        {/* Overview */}
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {highlightLocations(briefing.summary)}
        </p>

        {/* Developments */}
        {briefing.keyDevelopments && briefing.keyDevelopments.length > 0 && (
          <ul className="space-y-2 text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
            {briefing.keyDevelopments.map((dev, i) => (
              <li key={i} className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
                <span className="text-blue-500 dark:text-blue-400 mt-0.5 text-xs">▸</span>
                <span className="leading-relaxed">{highlightLocations(dev.headline)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer - Subtle */}
      <div className="px-4 py-1.5 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 dark:text-slate-600">
        {briefing.sourcesAnalyzed} sources
        {(briefing.pending || briefing.limited) && ' · updating...'}
      </div>
    </div>
  );
}
