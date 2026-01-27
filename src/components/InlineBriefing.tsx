'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WatchpointId } from '@/types';
import { regionDisplayNames } from '@/lib/regionDetection';
import { SparklesIcon, BoltIcon, RocketLaunchIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSession } from '@/lib/auth-client';

// Client-side cache - persists across region switches, keyed by region+tier
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const briefingCache = new Map<string, { data: BriefingData; cachedAt: number }>();

type ModelTier = 'quick' | 'advanced' | 'pro';

function getCacheKey(region: WatchpointId, tier: ModelTier): string {
  return `${region}:${tier}`;
}

function getCachedBriefing(region: WatchpointId, tier: ModelTier): BriefingData | null {
  const key = getCacheKey(region, tier);
  const cached = briefingCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.cachedAt;
  if (age > CACHE_TTL_MS) {
    briefingCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedBriefing(region: WatchpointId, tier: ModelTier, data: BriefingData): void {
  briefingCache.set(getCacheKey(region, tier), { data, cachedAt: Date.now() });
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
  pending?: boolean;
  limited?: boolean;
  tier?: ModelTier;
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

// Countries/locations to highlight in briefing text
const HIGHLIGHT_LOCATIONS = [
  'Ukraine', 'Russia', 'Crimea', 'Donbas', 'Kyiv', 'Moscow', 'Kharkiv', 'Odesa',
  'Israel', 'Gaza', 'West Bank', 'Lebanon', 'Beirut', 'Hezbollah', 'Hamas', 'Jerusalem', 'Tel Aviv',
  'Iran', 'Tehran', 'Syria', 'Damascus', 'Yemen', 'Houthi',
  'China', 'Taiwan', 'Beijing', 'Taipei', 'North Korea', 'Pyongyang', 'South Korea', 'Seoul',
  'Philippines', 'South China Sea', 'Japan', 'Tokyo',
  'United States', 'U.S.', 'US', 'Washington', 'Mexico', 'Venezuela', 'Cuba',
  'NATO', 'EU', 'European Union', 'Germany', 'France', 'UK', 'Britain', 'Poland', 'Belarus', 'Moldova',
  'Sudan', 'Ethiopia', 'Myanmar', 'Afghanistan', 'Pakistan', 'India', 'Kashmir',
];

const SOURCE_SUFFIXES = ['Post', 'Times', 'Monitor', 'Tribune', 'Herald', 'Journal', 'News', 'Today', 'Daily'];

function highlightLocations(text: string): React.ReactNode {
  if (!text) return text;

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
      const nextPart = parts[i + 1];
      if (nextPart) {
        const nextWord = nextPart.trim().split(/\s+/)[0];
        if (SOURCE_SUFFIXES.some(suffix => suffix.toLowerCase() === nextWord.toLowerCase())) {
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

// Tier display info with actual model names for transparency
// Links to Anthropic so users can learn about Claude models
const ANTHROPIC_URL = 'https://www.anthropic.com/claude';

const TIER_INFO: Record<ModelTier, {
  label: string;
  model: string;
  modelShort: string;
  icon: React.ElementType;
  color: string;
  description: string;
}> = {
  quick: {
    label: 'Quick',
    model: 'Claude Haiku',
    modelShort: 'Haiku',
    icon: BoltIcon,
    color: 'text-emerald-500',
    description: 'Fast AI summary',
  },
  advanced: {
    label: 'Advanced',
    model: 'Claude Sonnet',
    modelShort: 'Sonnet',
    icon: SparklesIcon,
    color: 'text-blue-500',
    description: 'Deeper AI analysis',
  },
  pro: {
    label: 'Pro',
    model: 'Claude Opus',
    modelShort: 'Opus',
    icon: RocketLaunchIcon,
    color: 'text-purple-500',
    description: 'Expert AI analysis',
  },
};

// Admin emails
const ADMIN_EMAILS = ['tbrown034@gmail.com', 'trevorbrown.web@gmail.com'];

// Loading phase messages
const LOADING_PHASES = [
  { minSec: 0, message: 'Scanning sources...' },
  { minSec: 3, message: 'Reading recent posts...' },
  { minSec: 6, message: 'Analyzing developments...' },
  { minSec: 10, message: 'Synthesizing brief...' },
  { minSec: 15, message: 'Finalizing summary...' },
];

function getLoadingMessage(elapsedSec: number, tier: ModelTier): string {
  // Pro tier takes longer
  const phases = tier === 'pro' ? LOADING_PHASES.map(p => ({ ...p, minSec: p.minSec * 1.5 })) : LOADING_PHASES;

  for (let i = phases.length - 1; i >= 0; i--) {
    if (elapsedSec >= phases[i].minSec) {
      return phases[i].message;
    }
  }
  return phases[0].message;
}

export function InlineBriefing({ region }: InlineBriefingProps) {
  const { data: session } = useSession();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<ModelTier>('quick');
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoLoadedRef = useRef(false);

  // Check if user is admin
  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  // Load collapsed preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-summary-collapsed');
    if (saved === 'true') setIsCollapsed(true);
  }, []);

  // Save collapsed preference
  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem('ai-summary-collapsed', String(newValue));
  };

  const fetchBriefing = useCallback(async (tier: ModelTier = 'quick', skipCache = false) => {
    // Check client-side cache first
    if (!skipCache) {
      const cached = getCachedBriefing(region, tier);
      if (cached) {
        console.log(`[InlineBriefing] Using cached ${tier} briefing for ${region}`);
        setBriefing({ ...cached, fromCache: true });
        setCurrentTier(tier);
        return;
      }
    }

    // Abort any previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setCurrentTier(tier);
    setLoadingElapsed(0);
    const startTime = performance.now();

    // Start elapsed time counter
    loadingIntervalRef.current = setInterval(() => {
      setLoadingElapsed(Math.floor((performance.now() - startTime) / 1000));
    }, 1000);

    try {
      const response = await fetch(`/api/summary?region=${region}&hours=6&tier=${tier}`, {
        signal: controllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[InlineBriefing] ${tier} briefing loaded in ${data.usage?.latencyMs || '?'}ms`);
      setBriefing(data);
      setCurrentTier(tier);

      // Cache the result
      if (!data.pending && !data.limited) {
        setCachedBriefing(region, tier, data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn(`[InlineBriefing] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Error loading briefing');
    } finally {
      setLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }
  }, [region]);

  // Auto-load on mount and region change
  useEffect(() => {
    // Reset state
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
    }

    setBriefing(null);
    setError(null);
    setLoading(false);
    setCurrentTier('quick');
    setLoadingElapsed(0);
    autoLoadedRef.current = false;

    // Auto-load quick summary after a short delay (let news load first)
    const timer = setTimeout(() => {
      if (!autoLoadedRef.current) {
        autoLoadedRef.current = true;
        fetchBriefing('quick');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [region, fetchBriefing]);

  // Loading state - shows which AI model is being used
  if (loading) {
    const TierIcon = TIER_INFO[currentTier].icon;
    return (
      <div className="mx-3 sm:mx-4 my-3 px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <TierIcon className={`w-5 h-5 ${TIER_INFO[currentTier].color} animate-pulse`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {getLoadingMessage(loadingElapsed, currentTier)}
              </span>
              <a
                href={ANTHROPIC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                {TIER_INFO[currentTier].model} ↗
              </a>
              {loadingElapsed > 0 && (
                <span className="text-2xs text-slate-400 dark:text-slate-500 tabular-nums">
                  {loadingElapsed}s
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-500 mt-0.5">
              {TIER_INFO[currentTier].description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mx-3 sm:mx-4 my-3 px-4 py-3 border border-amber-200 dark:border-amber-800/50 rounded-xl bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">{error}</span>
          </div>
          <button
            onClick={() => fetchBriefing('quick', true)}
            className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No briefing yet - show loading placeholder
  if (!briefing) {
    return (
      <div className="mx-3 sm:mx-4 my-3 px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-transparent rounded-full animate-spin" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Preparing AI summary</span>
            <a
              href={ANTHROPIC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              Claude Haiku ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Display briefing with upgrade options
  const TierIcon = TIER_INFO[briefing.tier || 'quick'].icon;

  // Collapsed view - minimal bar to expand
  if (isCollapsed) {
    return (
      <div className="mx-3 sm:mx-4 my-3">
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-between px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <TierIcon className={`w-4 h-4 ${TIER_INFO[briefing.tier || 'quick'].color}`} />
            <span className="text-xs text-slate-500 dark:text-slate-400">AI Summary</span>
            <span className="text-2xs text-slate-400 dark:text-slate-500">(hidden)</span>
          </div>
          <ChevronDownIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-4 my-3 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      {/* Header - clearly labeled as AI summary with model info and link */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TierIcon className={`w-4 h-4 ${TIER_INFO[briefing.tier || 'quick'].color}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            AI Summary
          </span>
          <a
            href={ANTHROPIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Learn more about Claude AI models"
          >
            {TIER_INFO[briefing.tier || 'quick'].model} ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          {briefing.fromCache && (
            <span className="text-2xs text-slate-400 dark:text-slate-600">cached</span>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title="Hide AI summary"
          >
            <ChevronUpIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body - Overview + Developments */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {highlightLocations(briefing.summary)}
        </p>

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

      {/* Footer with stats and upgrade options */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-2xs text-slate-400 dark:text-slate-600">
          {briefing.sourcesAnalyzed} sources · {briefing.usage?.latencyMs ? `${(briefing.usage.latencyMs / 1000).toFixed(1)}s` : ''}
        </span>

        {/* Upgrade buttons with Claude model names */}
        <div className="flex items-center gap-2">
          {(briefing.tier === 'quick') && (
            <button
              onClick={() => fetchBriefing('advanced', true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              title="Upgrade to Claude Sonnet for deeper analysis"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Try Sonnet</span>
            </button>
          )}

          {(briefing.tier === 'quick' || briefing.tier === 'advanced') && isAdmin && (
            <button
              onClick={() => fetchBriefing('pro', true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
              title="Upgrade to Claude Opus for expert analysis"
            >
              <RocketLaunchIcon className="w-3.5 h-3.5" />
              <span>Try Opus</span>
            </button>
          )}

          {briefing.tier === 'pro' && (
            <span className="flex items-center gap-1 text-2xs text-purple-500" title="Using Claude Opus">
              <RocketLaunchIcon className="w-3 h-3" />
              Best model
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
