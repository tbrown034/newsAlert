'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { NewsItem, WatchpointId } from '@/types';
import { NewsCard } from './NewsCard';
import { InlineBriefing } from './InlineBriefing';
import { ArrowPathIcon, ExclamationTriangleIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { regionDisplayNames } from '@/lib/regionDetection';

interface ActivityData {
  level: string;
  count: number;
  breaking: number;
  baseline?: number;
  multiplier?: number;
  vsNormal?: string;
  percentChange?: number;
}

interface NewsFeedProps {
  items: NewsItem[];
  selectedWatchpoint: WatchpointId;
  onSelectWatchpoint?: (id: WatchpointId) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean; // T2 async loading
  onRefresh?: () => void;
  activity?: Record<string, ActivityData>;
  error?: string | null;
  onRetry?: () => void;
  lastUpdated?: string | null;
  loadTimeMs?: number | null;
}

// Skeleton loader for news cards
function NewsCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="px-4 py-4 border-b border-slate-100 dark:border-slate-800"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col gap-3">
        <div className="space-y-2">
          <div className="h-4 skeleton-shimmer rounded w-[90%]" />
          <div className="h-4 skeleton-shimmer rounded w-[70%]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 skeleton-shimmer rounded" />
          <div className="h-3 skeleton-shimmer rounded w-24" />
          <div className="h-3 skeleton-shimmer rounded w-16" />
          <div className="h-3 skeleton-shimmer rounded w-12" />
        </div>
      </div>
    </div>
  );
}

// Error state component
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
      <div className="flex items-center gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-red-700 dark:text-red-300 text-sm font-medium">Failed to load feed</p>
          <p className="text-red-500 dark:text-red-400 text-xs mt-1 truncate">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300 rounded-lg transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// Volume indicator - Light theme
function VolumeIndicator({ activity }: { activity: ActivityData }) {
  const getVolumeText = () => {
    if (!activity.vsNormal || !activity.multiplier) {
      return { text: 'Normal volume', color: 'text-slate-500' };
    }
    if (activity.vsNormal === 'above') {
      const pct = activity.percentChange || 0;
      if (pct >= 200) return { text: `${activity.multiplier}× normal volume`, color: 'text-red-600' };
      if (pct >= 100) return { text: `${activity.multiplier}× normal volume`, color: 'text-orange-600' };
      return { text: `+${pct}% vs normal`, color: 'text-amber-600' };
    } else if (activity.vsNormal === 'below') {
      return { text: `${Math.abs(activity.percentChange || 0)}% below normal`, color: 'text-emerald-600' };
    }
    return { text: 'Normal volume', color: 'text-slate-500' };
  };

  const volume = getVolumeText();

  return (
    <div className="px-4 py-3 flex items-center justify-between text-xs border-b border-slate-100 dark:border-[#2f3336] bg-slate-50 dark:bg-[#16181c]">
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">{activity.count} posts</span>
        <span className="text-slate-400">in last hour</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${volume.color}`}>{volume.text}</span>
        {activity.baseline && (
          <span className="text-slate-400">(baseline: ~{activity.baseline}/hr)</span>
        )}
      </div>
    </div>
  );
}

// Region tab configuration
const regionTabs: { id: WatchpointId; label: string; icon?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'ukraine', label: 'Ukraine' },
  { id: 'china-taiwan', label: 'Taiwan' },
  { id: 'latam', label: 'LatAm' },
  { id: 'us-domestic', label: 'US' },
];

// Format relative time for last updated
function formatLastUpdated(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export function NewsFeed({
  items,
  selectedWatchpoint,
  onSelectWatchpoint,
  isLoading,
  isLoadingMore,
  onRefresh,
  activity,
  error,
  onRetry,
  lastUpdated,
  loadTimeMs,
}: NewsFeedProps) {
  // Track previously seen item IDs to animate new ones
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const filteredItems = useMemo(() => {
    return selectedWatchpoint === 'all'
      ? items
      : items.filter((item) => item.region === selectedWatchpoint);
  }, [items, selectedWatchpoint]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [filteredItems]);

  // Track new items for animation
  useEffect(() => {
    if (sortedItems.length === 0) return;

    const currentIds = new Set(sortedItems.map(item => item.id));

    if (isInitialLoadRef.current) {
      // First load - mark all as seen, no animation
      setSeenIds(currentIds);
      isInitialLoadRef.current = false;
    } else {
      // Find new items (not in seenIds)
      const newIds = new Set<string>();
      for (const item of sortedItems) {
        if (!seenIds.has(item.id)) {
          newIds.add(item.id);
        }
      }

      if (newIds.size > 0) {
        setNewItemIds(newIds);

        // Clear new status after animation completes
        const timeout = setTimeout(() => {
          setNewItemIds(new Set());
          setSeenIds(prev => {
            const next = new Set(prev);
            newIds.forEach(id => next.add(id));
            return next;
          });
        }, 2000); // Match animation duration

        return () => clearTimeout(timeout);
      }
    }
  }, [sortedItems, seenIds]);

  // Reset seen items when region changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    setSeenIds(new Set());
    setNewItemIds(new Set());
  }, [selectedWatchpoint]);

  const regionCounts = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.region] = (acc[item.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  // Get animation class for an item
  const getItemAnimationClass = (itemId: string, index: number): string => {
    if (newItemIds.has(itemId)) {
      // New item - animate in
      const delayClass = index < 5 ? `news-item-delay-${index + 1}` : '';
      return `news-item-enter news-item-new ${delayClass}`;
    }
    if (isInitialLoadRef.current || seenIds.size === 0) {
      // Initial load - subtle fade
      return 'news-initial-load';
    }
    return '';
  };

  return (
    <div className="flex flex-col bg-white dark:bg-black rounded-xl">
      {/* Region Tabs + Volume Indicator (sticky header) */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white dark:bg-black">
        <div className="flex items-center border-b border-slate-200 dark:border-[#2f3336]">
          {/* Scroll fade indicator - left */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white dark:from-black to-transparent pointer-events-none z-10 sm:hidden" />

          <div
            className="flex-1 overflow-x-auto scrollbar-hide scroll-smooth"
            role="tablist"
            aria-label="Region filters"
            onKeyDown={(e) => {
              const tabs = regionTabs;
              const currentIndex = tabs.findIndex(t => t.id === selectedWatchpoint);
              if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
                e.preventDefault();
                onSelectWatchpoint?.(tabs[currentIndex + 1].id);
              } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                e.preventDefault();
                onSelectWatchpoint?.(tabs[currentIndex - 1].id);
              }
            }}
          >
            <div className="flex">
              {regionTabs.map((tab, index) => {
                const isSelected = selectedWatchpoint === tab.id;
                const count = tab.id === 'all' ? items.length : (regionCounts[tab.id] || 0);

                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls="feed-panel"
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelectWatchpoint?.(tab.id)}
                    className={`
                      relative flex-shrink-0 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium
                      transition-colors duration-200 whitespace-nowrap min-h-[44px]
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
                      ${isSelected
                        ? 'text-slate-900 dark:text-[#e7e9ea]'
                        : 'text-slate-500 dark:text-[#71767b] hover:text-slate-700 dark:hover:text-[#e7e9ea] hover:bg-slate-50 dark:hover:bg-[#16181c]'
                      }
                    `}
                  >
                    {tab.icon && <span className="mr-1">{tab.icon}</span>}
                    {tab.label}

                    {count > 0 && tab.id !== 'all' && tab.id !== 'seismic' && (
                      <span className={`
                        ml-1.5 px-1.5 py-0.5 text-2xs sm:text-xs rounded-full
                        ${isSelected
                          ? 'bg-blue-100 dark:bg-[#031018] text-blue-700 dark:text-[#1d9bf0]'
                          : 'bg-slate-100 dark:bg-[#2f3336] text-slate-500 dark:text-[#71767b]'
                        }
                      `}>
                        {count}
                      </span>
                    )}

                    {isSelected && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scroll fade indicator - right */}
          <div className="absolute right-12 top-0 bottom-0 w-4 bg-gradient-to-l from-white dark:from-black to-transparent pointer-events-none z-10 sm:hidden" />

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              aria-label={isLoading ? 'Refreshing feed' : 'Refresh feed'}
              className="flex-shrink-0 px-3 py-3 min-h-[44px] text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50 border-l border-slate-200 dark:border-[#2f3336] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Volume indicator - part of sticky header */}
        {activity?.[selectedWatchpoint] && selectedWatchpoint !== 'all' && (
          <VolumeIndicator activity={activity[selectedWatchpoint]} />
        )}
      </div>

      <div id="feed-panel" role="tabpanel" aria-label={`News for ${selectedWatchpoint === 'all' ? 'all regions' : selectedWatchpoint}`}>

        {/* AI Analysis Section - only show after news loads */}
        {!isLoading && sortedItems.length > 0 && (
          <>
            <div className="mt-3" />
            <InlineBriefing region={selectedWatchpoint} />
          </>
        )}

        {/* Status bar - shows data freshness and latency */}
        {!isLoading && sortedItems.length > 0 && (
          <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-slate-100 dark:border-[#2f3336] bg-slate-50/50 dark:bg-[#16181c]/50">
            <span className="text-slate-500 dark:text-[#71767b]">
              {sortedItems.length} updates {selectedWatchpoint !== 'all' && `in ${regionDisplayNames[selectedWatchpoint]}`}
            </span>
            <div className="flex items-center gap-3">
              {loadTimeMs != null && (
                <span className={loadTimeMs > 10000 ? 'text-amber-500' : 'text-slate-400 dark:text-[#536471]'}>
                  {loadTimeMs > 1000 ? `${(loadTimeMs / 1000).toFixed(1)}s` : `${loadTimeMs}ms`}
                </span>
              )}
              {lastUpdated && (
                <span className="text-slate-400 dark:text-[#536471]">
                  {formatLastUpdated(lastUpdated)}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <ErrorState message={error} onRetry={onRetry} />
        )}

        {isLoading && sortedItems.length === 0 && !error && (
          <div className="flex flex-col">
            {[...Array(5)].map((_, i) => (
              <NewsCardSkeleton key={i} index={i} />
            ))}
          </div>
        )}

        {!isLoading && !error && sortedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <GlobeAltIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </div>
            <span className="text-slate-800 dark:text-slate-100 text-base sm:text-lg font-medium mb-1">No updates yet</span>
            <span className="text-slate-500 dark:text-slate-400 text-sm text-center max-w-xs">
              {selectedWatchpoint === 'all'
                ? 'News will appear here as it breaks'
                : `No news for ${regionDisplayNames[selectedWatchpoint] || 'this region'} yet`}
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ArrowPathIcon className="w-4 h-4 inline mr-1.5" />
                Refresh feed
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 p-2 sm:p-3 news-feed-list">
          {sortedItems.map((item, index) => (
            <div
              key={item.id}
              className={getItemAnimationClass(item.id, index)}
            >
              <NewsCard item={item} />
            </div>
          ))}
        </div>

        {/* Loading more indicator (T2 async) */}
        {isLoadingMore && sortedItems.length > 0 && (
          <div className="py-3 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-[#71767b]">
            <div className="w-3 h-3 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin" />
            <span>Loading more sources...</span>
          </div>
        )}

        {isLoading && sortedItems.length > 0 && (
          <div className="py-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
