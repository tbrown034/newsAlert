'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NewsItem, WatchpointId } from '@/types';
import { NewsCard } from './NewsCard';
import { EditorialCard, isEditorialItem } from './EditorialCard';
import { BriefingCard } from './BriefingCard';
import { ArrowPathIcon, ExclamationTriangleIcon, GlobeAltIcon, ChevronDownIcon, SignalIcon } from '@heroicons/react/24/outline';
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

// Tab selection type
type SelectedTab = WatchpointId;

interface NewsFeedProps {
  items: NewsItem[];
  selectedWatchpoint: WatchpointId;
  onSelectWatchpoint?: (id: WatchpointId) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  activity?: Record<string, ActivityData>;
  error?: string | null;
  onRetry?: () => void;
  lastUpdated?: string | null;
  loadTimeMs?: number | null;
  // Live update settings
  pendingCount?: number;
  onShowPending?: () => void;
  autoUpdate?: boolean;
  onToggleAutoUpdate?: () => void;
  // Stats for header
  totalPosts?: number;
  uniqueSources?: number;
  hoursWindow?: number;
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
    <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-600 dark:text-slate-400 font-medium">{activity.count}/hr</span>
        <span className={`font-medium ${volume.color}`}>
          {volume.text === 'Normal volume' ? '(normal)' : `(${volume.text.replace(' volume', '').replace('normal ', '')})`}
        </span>
      </div>
      {activity.baseline && (
        <span className="text-slate-400 dark:text-slate-500 text-2xs" title={`Baseline: ~${activity.baseline} posts/hr for this region`}>
          ⓘ ~{activity.baseline}/hr avg
        </span>
      )}
    </div>
  );
}

// Tab configuration
type TabId = WatchpointId;

interface TabConfig {
  id: TabId;
  label: string;
  alwaysVisible?: boolean; // Show on all screen sizes
  minScreen?: 'sm' | 'md' | 'lg'; // Minimum screen size to show inline
}

// All tabs in order - All always visible, regions in More dropdown
const allTabs: TabConfig[] = [
  { id: 'all', label: 'All', alwaysVisible: true },
  // Regional tabs - all go in More dropdown
  { id: 'us', label: 'US' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'europe-russia', label: 'Europe-Russia' },
  { id: 'asia', label: 'Asia' },
  { id: 'latam', label: 'Americas' },
];

// Platform filter options
type PlatformFilter = 'all' | 'bluesky' | 'rss' | 'telegram' | 'mastodon' | 'youtube' | 'reddit';
const platformFilters: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'rss', label: 'RSS' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'reddit', label: 'Reddit' },
];

// Format actual time for last updated (e.g., "3:45 PM")
function formatActualTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function NewsFeed({
  items,
  selectedWatchpoint,
  onSelectWatchpoint,
  isLoading,
  onRefresh,
  activity,
  error,
  onRetry,
  lastUpdated,
  loadTimeMs,
  totalPosts,
  uniqueSources,
  hoursWindow = 6,
}: NewsFeedProps) {
  // Track previously seen item IDs to animate new ones
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [regionalExpanded, setRegionalExpanded] = useState(false);
  const [sourceFilterExpanded, setSourceFilterExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<SelectedTab>('all'); // Local tab state, defaults to All
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  // Track items that existed when user first loaded the page (for "new since arrival" divider)
  const [initialSessionIds, setInitialSessionIds] = useState<Set<string> | null>(null);

  // Handle tab selection - update local and parent state
  const handleTabSelect = useCallback((tabId: TabId) => {
    setSelectedTab(tabId);
    if (onSelectWatchpoint) {
      onSelectWatchpoint(tabId);
    }
  }, [onSelectWatchpoint]);

  // Sync local tab state with parent's selectedWatchpoint (e.g., when map region is clicked)
  useEffect(() => {
    if (selectedWatchpoint !== selectedTab) {
      setSelectedTab(selectedWatchpoint);
    }
  }, [selectedWatchpoint]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Apply region filter
    if (selectedTab !== 'all') {
      filtered = items.filter((item) => item.region === selectedTab);
    }

    // Apply platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter((item) => item.source.platform === platformFilter);
    }

    return filtered;
  }, [items, selectedTab, platformFilter]);

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
      // Also capture these as the "initial session" items for the divider
      if (initialSessionIds === null) {
        setInitialSessionIds(currentIds);
      }
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
  }, [sortedItems, seenIds, initialSessionIds]);

  // Reset seen items when tab changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    setSeenIds(new Set());
    setNewItemIds(new Set());
    setInitialSessionIds(null); // Reset so new tab gets its own "initial" set
  }, [selectedTab]);

  // Count items by region
  const regionCounts = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.region] = (acc[item.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  // Count items by platform (from region-filtered items, NOT platform-filtered)
  const platformCounts = useMemo(() => {
    // Apply only region filter, not platform filter
    const regionFiltered = selectedTab === 'all'
      ? items
      : items.filter((item) => item.region === selectedTab);

    return regionFiltered.reduce((acc, item) => {
      const platform = item.source.platform;
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [items, selectedTab]);

  // Get count for a tab
  const getTabCount = (tabId: TabId): number => {
    if (tabId === 'all') return items.length;
    return regionCounts[tabId] || 0;
  };

  // Check if a tab is in the More dropdown (not visible inline)
  const isInMoreDropdown = (tab: TabConfig): boolean => {
    if (tab.alwaysVisible) return false;
    // Without JS media queries, we'll put non-alwaysVisible tabs in More
    // The responsive classes will show/hide them appropriately
    return !tab.minScreen;
  };

  // Tabs that always show inline
  const inlineTabs = allTabs.filter(t => t.alwaysVisible || t.minScreen);
  // Tabs that go in More dropdown
  const dropdownTabs = allTabs.filter(t => !t.alwaysVisible && !t.minScreen);
  // Check if selected tab is in dropdown
  const isDropdownTabSelected = dropdownTabs.some(t => t.id === selectedTab);

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

  // Calculate where to show the "new since arrival" divider
  const newSinceArrivalCount = useMemo(() => {
    if (!initialSessionIds || initialSessionIds.size === 0) return 0;
    return sortedItems.filter(item => !initialSessionIds.has(item.id)).length;
  }, [sortedItems, initialSessionIds]);

  // Find the index where we should insert the divider (after all new items)
  const dividerIndex = useMemo(() => {
    if (newSinceArrivalCount === 0 || !initialSessionIds) return -1;
    // Find first item that WAS in the initial session
    for (let i = 0; i < sortedItems.length; i++) {
      if (initialSessionIds.has(sortedItems[i].id)) {
        return i; // Insert divider before this item
      }
    }
    return -1;
  }, [sortedItems, initialSessionIds, newSinceArrivalCount]);

  // Get the current region label
  const currentRegionLabel = selectedTab === 'all'
    ? 'All Regions'
    : allTabs.find(t => t.id === selectedTab)?.label || 'All Regions';

  // Get the current source label
  const currentSourceLabel = platformFilter === 'all'
    ? 'All Sources'
    : platformFilters.find(f => f.id === platformFilter)?.label || 'All Sources';

  const totalFilteredPosts = Object.values(platformCounts).reduce((sum, c) => sum + c, 0);

  // Calculate display stats
  const displayPosts = totalPosts ?? items.length;
  const displaySources = uniqueSources ?? new Set(items.map(i => i.source.id)).size;

  return (
    <div className="flex flex-col">
      {/* Header - matches Global Monitor pattern */}
      <div className="relative z-10 px-3 sm:px-4 py-2.5 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 rounded-t-2xl">
          {/* Row 1: Title + Refresh */}
          <div className="flex items-center justify-between mb-2">
            {/* Title */}
            <div className="flex items-center gap-2">
              <SignalIcon className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Live Wire</h2>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            {/* Refresh button with timestamp */}
            {onRefresh && (
              <div className="flex flex-col items-end gap-0.5">
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  aria-label={isLoading ? 'Refreshing feed' : 'Refresh feed'}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Refreshing...' : 'Refresh Feed'}</span>
                </button>
                {lastUpdated && (
                  <span className="text-2xs text-slate-400 dark:text-slate-500" suppressHydrationWarning>
                    Last updated {formatActualTime(lastUpdated)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Stats */}
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
            {'Fetched '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{displayPosts} posts</span>
            {' from '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{displaySources} sources</span>
            {' in last six hours'}
          </div>

          {/* Row 2: Filter dropdowns */}
          <div className="flex items-center gap-2 sm:gap-3 pb-2">
            {/* Region Dropdown */}
            <div className="relative" ref={moreDropdownRef}>
              <button
                onClick={() => {
                  setRegionalExpanded(!regionalExpanded);
                  setSourceFilterExpanded(false);
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">{currentRegionLabel}</span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${regionalExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Region dropdown menu */}
              {regionalExpanded && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                  {allTabs.map((tab) => {
                    const isSelected = selectedTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          handleTabSelect(tab.id);
                          setRegionalExpanded(false);
                        }}
                        className={`
                          w-full px-3 py-2 text-sm font-medium transition-colors text-left flex items-center gap-2
                          ${isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        {tab.id === 'all' ? 'All Regions' : tab.label}
                        {isSelected && <span className="ml-auto text-blue-500">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Source Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setSourceFilterExpanded(!sourceFilterExpanded);
                  setRegionalExpanded(false);
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">{currentSourceLabel}</span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${sourceFilterExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Source dropdown menu */}
              {sourceFilterExpanded && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                  {platformFilters.map((filter) => {
                    const isSelected = platformFilter === filter.id;
                    const count = filter.id === 'all'
                      ? totalFilteredPosts
                      : (platformCounts[filter.id] || 0);

                    // Hide platforms with 0 items (except "All" and currently selected)
                    if (filter.id !== 'all' && count === 0 && !isSelected && !isLoading) {
                      return null;
                    }

                    return (
                      <button
                        key={filter.id}
                        onClick={() => {
                          setPlatformFilter(filter.id);
                          setSourceFilterExpanded(false);
                        }}
                        className={`
                          w-full px-3 py-2 text-sm font-medium transition-colors text-left flex items-center justify-between
                          ${isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        <span>{filter.id === 'all' ? 'All Sources' : filter.label}</span>
                        <span className={`text-xs ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                          {isLoading && filter.id !== 'all' && count === 0 ? '...' : count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Volume indicator (only for region tabs) */}
      {selectedTab !== 'all' && activity?.[selectedTab] && (
        <VolumeIndicator activity={activity[selectedTab]} />
      )}

      <div id="feed-panel" role="tabpanel" aria-label={`News for ${selectedTab === 'all' ? 'all regions' : selectedTab}`}>

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
              {selectedTab === 'all'
                ? 'News will appear here as it breaks'
                : `No news for ${regionDisplayNames[selectedTab] || 'this region'} yet`}
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

        <div className="flex flex-col gap-4 px-3 sm:px-4 pt-4 pb-3 sm:pb-4 news-feed-list">
          {/* AI Briefing Card - appears at top of feed */}
          {!isLoading && sortedItems.length > 0 && (
            <BriefingCard region={selectedTab} />
          )}

          {sortedItems.map((item, index) => (
            <div key={item.id}>
              {/* New since arrival divider - appears before first "old" item */}
              {dividerIndex === index && dividerIndex > 0 && (
                <div className="flex items-center gap-3 py-3 mb-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent dark:via-blue-500/40" />
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap px-2">
                    {newSinceArrivalCount} new since you arrived
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent dark:via-blue-500/40" />
                </div>
              )}
              <div className={getItemAnimationClass(item.id, index)}>
                {isEditorialItem(item) ? (
                  <EditorialCard item={item} />
                ) : (
                  <NewsCard item={item} />
                )}
              </div>
            </div>
          ))}
        </div>


        {isLoading && sortedItems.length > 0 && (
          <div className="py-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
