'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WatchpointId } from '@/types';
import { regionDisplayNames } from '@/lib/regionDetection';
import {
  SparklesIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
  ShareIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolidIcon } from '@heroicons/react/24/solid';

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

interface BriefingCardProps {
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

// News outlets that contain location names - should NOT be highlighted
const NEWS_OUTLET_PATTERNS = [
  'France 24', 'France24',
  'Jerusalem Post',
  'South China Morning Post',
  'Washington Post',
  'China Daily',
  'Russia Today', 'RT',
  'India Today',
  'Japan Times',
  'Korea Herald', 'Korea Times',
  'Taiwan News',
  'Israel Hayom',
  'Moscow Times',
  'Kyiv Independent', 'Kyiv Post',
  'Tehran Times',
  'Damascus Now',
  'Beirut Today',
  'Gaza Now',
];

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
      const nextPart = parts[i + 1] || '';
      const prevPart = parts[i - 1] || '';

      const contextAfter = part + nextPart.slice(0, 30);
      const contextBefore = prevPart.slice(-20) + part;

      const isPartOfOutlet = NEWS_OUTLET_PATTERNS.some(outlet => {
        const outletLower = outlet.toLowerCase();
        return contextAfter.toLowerCase().startsWith(outletLower) ||
               contextBefore.toLowerCase().endsWith(outletLower) ||
               contextAfter.toLowerCase().includes(outletLower);
      });

      if (isPartOfOutlet) {
        return part;
      }

      if (nextPart) {
        const nextWord = nextPart.trim().split(/\s+/)[0];
        if (SOURCE_SUFFIXES.some(suffix => suffix.toLowerCase() === nextWord.toLowerCase())) {
          return part;
        }
      }

      return (
        <span key={i} className="font-semibold text-[var(--foreground)]">
          {part}
        </span>
      );
    }
    return part;
  });
}

// Tier display info with model names
const ANTHROPIC_URL = 'https://www.anthropic.com/claude';

const TIER_INFO: Record<ModelTier, {
  label: string;
  model: string;
  modelShort: string;
}> = {
  quick: {
    label: 'Quick',
    model: 'Claude Haiku',
    modelShort: 'Haiku',
  },
  advanced: {
    label: 'Advanced',
    model: 'Claude Sonnet',
    modelShort: 'Sonnet',
  },
  pro: {
    label: 'Pro',
    model: 'Claude Opus',
    modelShort: 'Opus',
  },
};

// Loading phase messages
const LOADING_PHASES = [
  { minSec: 0, message: 'Scanning sources...' },
  { minSec: 3, message: 'Reading recent posts...' },
  { minSec: 6, message: 'Analyzing developments...' },
  { minSec: 10, message: 'Synthesizing brief...' },
  { minSec: 15, message: 'Finalizing summary...' },
];

function getLoadingMessage(elapsedSec: number, tier: ModelTier): string {
  const phases = tier === 'pro' ? LOADING_PHASES.map(p => ({ ...p, minSec: p.minSec * 1.5 })) : LOADING_PHASES;

  for (let i = phases.length - 1; i >= 0; i--) {
    if (elapsedSec >= phases[i].minSec) {
      return phases[i].message;
    }
  }
  return phases[0].message;
}

// Region badge colors - matching NewsCard
const regionBadges: Record<WatchpointId, { label: string; color: string }> = {
  'us': { label: 'US', color: 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border-light)]' },
  'latam': { label: 'AMERICAS', color: 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border-light)]' },
  'middle-east': { label: 'MIDEAST', color: 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border-light)]' },
  'europe-russia': { label: 'EUR', color: 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border-light)]' },
  'asia': { label: 'ASIA', color: 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border-light)]' },
  'seismic': { label: 'SEISMIC', color: 'bg-[var(--color-elevated-muted)] text-[var(--color-elevated)]' },
  'all': { label: 'GLOBAL', color: 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border-light)]' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Pulse Logo Avatar component - matches header brand
function PulseAvatar() {
  return (
    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-sm border border-slate-700 flex-shrink-0">
      <svg viewBox="0 0 32 32" className="w-5 h-5">
        <text x="8" y="20" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="700" fill="#ffffff">P</text>
        <path d="M4 24 L10 24 L12 21 L14 27 L16 22 L18 24 L28 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

export function BriefingCard({ region }: BriefingCardProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<ModelTier>('quick');
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [isPinned, setIsPinned] = useState(true);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoLoadedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [modelDropdownOpen]);

  // Load pinned preference from localStorage
  useEffect(() => {
    const savedPinned = localStorage.getItem('ai-briefing-pinned');
    if (savedPinned === 'false') setIsPinned(false);
  }, []);

  // Save pinned preference
  const togglePinned = () => {
    const newValue = !isPinned;
    setIsPinned(newValue);
    localStorage.setItem('ai-briefing-pinned', String(newValue));
  };

  const fetchBriefing = useCallback(async (tier: ModelTier = 'quick', skipCache = false) => {
    if (!skipCache) {
      const cached = getCachedBriefing(region, tier);
      if (cached) {
        setBriefing({ ...cached, fromCache: true });
        setCurrentTier(tier);
        return;
      }
    }

    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setCurrentTier(tier);
    setLoadingElapsed(0);
    const startTime = performance.now();

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
      setBriefing(data);
      setCurrentTier(tier);

      if (!data.pending && !data.limited) {
        setCachedBriefing(region, tier, data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
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

    const timer = setTimeout(() => {
      if (!autoLoadedRef.current) {
        autoLoadedRef.current = true;
        fetchBriefing('quick');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [region, fetchBriefing]);

  const regionBadge = regionBadges[region] || regionBadges['all'];
  const tierInfo = TIER_INFO[briefing?.tier || currentTier];
  const generatedAt = briefing?.generatedAt ? new Date(briefing.generatedAt) : null;

  // Handle share
  const handleShare = async () => {
    const shareText = `AI News Briefing for ${regionDisplayNames[region] || 'Global'}: ${briefing?.summary?.slice(0, 200)}...`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pulse AI Briefing',
          text: shareText,
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Ignore clipboard errors
    }
  };

  // Loading state card
  if (loading) {
    return (
      <article className="relative px-3 py-3 sm:px-4 sm:py-4 bg-[var(--background-card)] rounded-xl border-2 border-slate-400 dark:border-slate-500">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PulseAvatar />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-label font-medium text-[var(--foreground)]">Pulse AI</span>
                <SparklesIcon className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                <span className="text-caption text-[var(--foreground-light)] flex-shrink-0">
                  · {getLoadingMessage(loadingElapsed, currentTier)}
                </span>
                {loadingElapsed > 0 && (
                  <span className="text-caption text-[var(--foreground-light)] tabular-nums">
                    {loadingElapsed}s
                  </span>
                )}
              </div>
            </div>
            <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md flex-shrink-0 ${regionBadge.color}`}>
              {regionBadge.label}
            </span>
          </div>
          <div className="py-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--foreground-muted)]">Generating briefing with {tierInfo.model}...</span>
          </div>
        </div>
      </article>
    );
  }

  // Error state card
  if (error) {
    return (
      <article className="relative px-3 py-3 sm:px-4 sm:py-4 bg-[var(--background-card)] rounded-xl border-2 border-slate-400 dark:border-slate-500">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PulseAvatar />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-label font-medium text-[var(--foreground)]">Pulse AI</span>
                <SparklesIcon className="w-4 h-4 text-cyan-500 flex-shrink-0" />
              </div>
            </div>
            <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md flex-shrink-0 ${regionBadge.color}`}>
              {regionBadge.label}
            </span>
          </div>
          <div className="py-2">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => fetchBriefing('quick', true)}
              className="text-caption font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </article>
    );
  }

  // No briefing yet - show placeholder
  if (!briefing) {
    return (
      <article className="relative px-3 py-3 sm:px-4 sm:py-4 bg-[var(--background-card)] rounded-xl border-2 border-slate-400 dark:border-slate-500">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PulseAvatar />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-label font-medium text-[var(--foreground)]">Pulse AI</span>
                <SparklesIcon className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                <span className="text-caption text-[var(--foreground-light)]">· Preparing...</span>
              </div>
            </div>
            <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md flex-shrink-0 ${regionBadge.color}`}>
              {regionBadge.label}
            </span>
          </div>
          <div className="py-3 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--foreground-muted)]">Preparing summary...</span>
          </div>
        </div>
      </article>
    );
  }

  // Main briefing card
  return (
    <article className="relative px-3 py-3 sm:px-4 sm:py-4 bg-[var(--background-card)] rounded-xl border-2 border-slate-400 dark:border-slate-500 hover:border-slate-500 dark:hover:border-slate-400 transition-all duration-200">
      <div className="flex flex-col gap-2">
        {/* Row 1: Avatar + Name + Meta | Region */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <PulseAvatar />
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="text-label font-medium text-[var(--foreground)]">Pulse AI</span>
              <SparklesIcon className="w-4 h-4 text-cyan-500 flex-shrink-0" />
              <span className="text-caption text-[var(--foreground-light)] flex-shrink-0" suppressHydrationWarning>
                · {briefing.sourcesAnalyzed} sources
                {generatedAt && ` · ${formatTimeAgo(generatedAt)}`}
              </span>
            </div>
          </div>
          <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md flex-shrink-0 ${regionBadge.color}`}>
            {regionBadge.label}
          </span>
        </div>

        {/* Row 2: Summary text */}
        <div className="text-body py-1">
          <p className="text-[var(--foreground)] leading-relaxed">
            {highlightLocations(briefing.summary)}
          </p>
        </div>

        {/* Key developments as bullet points */}
        {briefing.keyDevelopments && briefing.keyDevelopments.length > 0 && (
          <ul className="space-y-1.5 pl-1">
            {briefing.keyDevelopments.map((dev, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground-muted)]">
                <span className="text-cyan-500 mt-0.5">•</span>
                <span className="leading-snug">{highlightLocations(dev.headline)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Row 3: Metadata + Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)]">
          {/* Left: AI tag + Claude attribution with model selector */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--foreground-light)]">
            <span className="px-2 py-0.5 text-[10px] tracking-wide uppercase font-semibold rounded-sm bg-cyan-600 dark:bg-cyan-500 text-white dark:text-cyan-950">
              AI
            </span>
            <span>Generated with</span>
            {/* Model selector dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                disabled={loading}
                className="flex items-center gap-0.5 font-medium text-orange-600 dark:text-orange-400 hover:text-orange-500 dark:hover:text-orange-300 transition-colors disabled:opacity-50"
              >
                {tierInfo.model}
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {modelDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      fetchBriefing('quick', true);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-[var(--background-secondary)] transition-colors ${
                      briefing.tier === 'quick' ? 'bg-[var(--background-secondary)]' : ''
                    }`}
                  >
                    <div className="font-medium text-[var(--foreground)]">Claude Haiku</div>
                    <div className="text-[10px] text-[var(--foreground-light)]">Faster · economical</div>
                  </button>
                  <button
                    onClick={() => {
                      fetchBriefing('advanced', true);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-[var(--background-secondary)] transition-colors border-t border-[var(--border-light)] ${
                      briefing.tier === 'advanced' ? 'bg-[var(--background-secondary)]' : ''
                    }`}
                  >
                    <div className="font-medium text-[var(--foreground)]">Claude Sonnet</div>
                    <div className="text-[10px] text-[var(--foreground-light)]">Balanced · recommended</div>
                  </button>
                  <button
                    onClick={() => {
                      fetchBriefing('pro', true);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-[var(--background-secondary)] transition-colors border-t border-[var(--border-light)] ${
                      briefing.tier === 'pro' ? 'bg-[var(--background-secondary)]' : ''
                    }`}
                  >
                    <div className="font-medium text-[var(--foreground)]">Claude Opus</div>
                    <div className="text-[10px] text-[var(--foreground-light)]">Smarter · deeper analysis</div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePinned}
              className={`flex items-center gap-1.5 transition-colors ${
                isPinned
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-[var(--foreground-light)] hover:text-[var(--foreground-muted)]'
              }`}
              aria-label={isPinned ? 'Unpin briefing' : 'Pin briefing to top'}
              title={isPinned ? 'Pinned to top' : 'Pin to top'}
            >
              {isPinned ? (
                <MapPinSolidIcon className="w-4 h-4" />
              ) : (
                <MapPinIcon className="w-4 h-4" />
              )}
              <span className="text-caption font-medium hidden sm:inline">
                {isPinned ? 'Pinned' : 'Pin'}
              </span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-[var(--foreground-light)] hover:text-[var(--foreground-muted)] transition-colors"
              aria-label="Share briefing"
            >
              <ShareIcon className="w-4 h-4" />
              <span className="text-caption font-medium hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// Export pinned state getter for NewsFeed to use
export function useBriefingPinned(): boolean {
  const [isPinned, setIsPinned] = useState(true);

  useEffect(() => {
    const savedPinned = localStorage.getItem('ai-briefing-pinned');
    if (savedPinned === 'false') setIsPinned(false);
  }, []);

  return isPinned;
}
