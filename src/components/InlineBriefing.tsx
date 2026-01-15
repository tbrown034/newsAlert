'use client';

import { useState, useEffect } from 'react';
import { WatchpointId } from '@/types';
import { regionDisplayNames } from '@/lib/regionDetection';

interface BriefingData {
  region: WatchpointId;
  timeWindowHours: number;
  generatedAt: string;
  summary: string;
  tensionScore?: number;
  sourcesAnalyzed: number;
  topSources: string[];
  fromCache?: boolean;
}

interface InlineBriefingProps {
  region: WatchpointId;
}

// Tension level styling - Light theme
function getTensionStyle(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 8) return { label: 'CRITICAL', color: 'text-red-600', bgColor: 'bg-red-100' };
  if (score >= 6) return { label: 'HIGH', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  if (score >= 4) return { label: 'ELEVATED', color: 'text-amber-600', bgColor: 'bg-amber-100' };
  if (score >= 2) return { label: 'WATCHFUL', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  return { label: 'STABLE', color: 'text-emerald-600', bgColor: 'bg-emerald-100' };
}

export function InlineBriefing({ region }: InlineBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const fetchBriefing = async () => {
      setLoading(true);
      setError(null);
      setLoadTimeMs(null);
      const startTime = performance.now();
      console.log(`[InlineBriefing] Fetching briefing for region: ${region}`);

      try {
        const response = await fetch(`/api/summary?region=${region}&hours=4`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - startTime);
        setLoadTimeMs(elapsed);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[InlineBriefing] API error ${response.status} (${elapsed}ms):`, errorData);
          throw new Error(errorData.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[InlineBriefing] Briefing loaded in ${elapsed}ms, ${data.sourcesAnalyzed} sources analyzed`);
        setBriefing(data);
      } catch (err) {
        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - startTime);
        setLoadTimeMs(elapsed);
        if (err instanceof Error && err.name === 'AbortError') {
          // Use warn instead of error to avoid triggering Next.js dev overlay
          console.warn(`[InlineBriefing] Request timed out after ${elapsed}ms`);
          setError('Request timed out. The server may be busy.');
        } else {
          console.warn(`[InlineBriefing] Fetch error (${elapsed}ms):`, err);
          setError(err instanceof Error ? err.message : 'Error loading briefing');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [region]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-4 my-3 px-4 py-3 border border-slate-200 dark:border-[#2f3336] rounded-lg bg-slate-50 dark:bg-[#16181c]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#1d9bf0] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-600 dark:text-[#71767b]">Generating AI briefing...</span>
        </div>
      </div>
    );
  }

  // Error state - show error message with retry option
  if (error) {
    // Don't console.error - this triggers Next.js dev overlay for expected timeouts
    return (
      <div className="mx-4 my-3 px-4 py-3 border border-amber-200 rounded-lg bg-amber-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <span className="text-xs text-amber-700">Briefing unavailable</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-amber-600 hover:text-amber-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!briefing) {
    return null;
  }

  const tensionScore = briefing.tensionScore || 5;
  const tension = getTensionStyle(tensionScore);

  return (
    <div className="mx-4 my-3 border border-slate-200 dark:border-[#2f3336] rounded-lg overflow-hidden bg-white dark:bg-[#16181c]">
      {/* Header - Clean and minimal */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#16181c] border-b border-slate-200 dark:border-[#2f3336]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-[#71767b] uppercase tracking-wide">
              Summary
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

      {/* Footer - minimal stats with latency */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-[#16181c] border-t border-slate-100 dark:border-[#2f3336] text-2xs text-slate-400 dark:text-[#536471] flex justify-between">
        <span>{briefing.sourcesAnalyzed} posts analyzed</span>
        {loadTimeMs !== null && (
          <span className={loadTimeMs > 10000 ? 'text-amber-500' : ''}>
            {loadTimeMs > 1000 ? `${(loadTimeMs / 1000).toFixed(1)}s` : `${loadTimeMs}ms`}
          </span>
        )}
      </div>
    </div>
  );
}
