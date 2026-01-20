'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NewsItem, WatchpointId } from '@/types';
import { NewsCard } from './NewsCard';
import { InlineBriefing } from './InlineBriefing';
import { ArrowPathIcon, ExclamationTriangleIcon, GlobeAltIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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

// Extended type for tab selection (includes 'main' which isn't a region)
type SelectedTab = WatchpointId | 'main';

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

// Tab configuration
// 'main' is a special filter (high-impact stories), not a region
type TabId = WatchpointId | 'main';

interface TabConfig {
  id: TabId;
  label: string;
  alwaysVisible?: boolean; // Show on all screen sizes
  minScreen?: 'sm' | 'md' | 'lg'; // Minimum screen size to show inline
}

// All tabs in order - Main and All always visible, regions in More dropdown
const allTabs: TabConfig[] = [
  { id: 'main', label: 'Main', alwaysVisible: true },
  { id: 'all', label: 'All', alwaysVisible: true },
  // Regional tabs - all go in More dropdown
  { id: 'us', label: 'US' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'europe-russia', label: 'Europe-Russia' },
  { id: 'asia', label: 'Asia' },
  { id: 'latam', label: 'Americas' },
];

// Platform filter options
type PlatformFilter = 'all' | 'bluesky' | 'rss';
const platformFilters: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'rss', label: 'RSS' },
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
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<SelectedTab>('main'); // Local tab state, defaults to Main
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  // Handle tab selection - 'main' and 'all' stay local, regions propagate up
  const handleTabSelect = useCallback((tabId: TabId) => {
    setSelectedTab(tabId);
    // For region tabs, also update parent state
    if (tabId !== 'main' && onSelectWatchpoint) {
      onSelectWatchpoint(tabId as WatchpointId);
    }
  }, [onSelectWatchpoint]);

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

  // Keywords that boost items into Main feed
  const MAIN_FEED_KEYWORDS_HIGH = ['breaking', 'attack', 'invasion', 'war', 'missile', 'nuclear', 'coup', 'killed'];
  const MAIN_FEED_KEYWORDS_MED = ['strike', 'explosion', 'protest', 'emergency', 'casualties', 'troops'];
  const MAIN_FEED_KEYWORDS_LOW = ['military', 'sanctions', 'tensions', 'ceasefire', 'diplomatic'];

  // Calculate Main Feed score for an item
  const getMainFeedScore = useCallback((item: NewsItem): number => {
    // Base value from source confidence (map 0-100 to 1-5)
    const baseValue = Math.min(5, Math.max(1, Math.ceil(item.source.confidence / 20)));

    // Keyword modifier
    const titleLower = item.title.toLowerCase();
    let keywordMod = 0;
    if (MAIN_FEED_KEYWORDS_HIGH.some(kw => titleLower.includes(kw))) keywordMod = 3;
    else if (MAIN_FEED_KEYWORDS_MED.some(kw => titleLower.includes(kw))) keywordMod = 2;
    else if (MAIN_FEED_KEYWORDS_LOW.some(kw => titleLower.includes(kw))) keywordMod = 1;

    // Region activity modifier
    let regionMod = 0;
    const regionActivity = activity?.[item.region];
    if (regionActivity?.level === 'critical') regionMod = 2;
    else if (regionActivity?.level === 'elevated') regionMod = 1;

    return baseValue + keywordMod + regionMod;
  }, [activity]);

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Apply tab filter
    if (selectedTab === 'main') {
      // Main feed: score >= 5 OR base value >= 4 (high-value sources always qualify)
      filtered = items.filter(item => {
        const score = getMainFeedScore(item);
        const baseValue = Math.min(5, Math.max(1, Math.ceil(item.source.confidence / 20)));
        return score >= 5 || baseValue >= 4;
      });
    } else if (selectedTab !== 'all') {
      // Region filter
      filtered = items.filter((item) => item.region === selectedTab);
    }

    // Apply platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter((item) => item.source.platform === platformFilter);
    }

    return filtered;
  }, [items, selectedTab, platformFilter, getMainFeedScore]);

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

  // Reset seen items when tab changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    setSeenIds(new Set());
    setNewItemIds(new Set());
  }, [selectedTab]);

  // Count items by region
  const regionCounts = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.region] = (acc[item.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  // Count Main feed items
  const mainFeedCount = useMemo(() => {
    return items.filter(item => {
      const score = getMainFeedScore(item);
      const baseValue = Math.min(5, Math.max(1, Math.ceil(item.source.confidence / 20)));
      return score >= 5 || baseValue >= 4;
    }).length;
  }, [items, getMainFeedScore]);

  // Count items by platform (respects current filter)
  const platformCounts = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const platform = item.source.platform;
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredItems]);

  // Determine which tabs go in More dropdown based on screen size
  // For simplicity, we'll show overflow tabs in More on mobile
  const getTabCount = (tabId: TabId): number => {
    if (tabId === 'main') return mainFeedCount;
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

  return (
    <div className="flex flex-col bg-white dark:bg-black rounded-2xl overflow-hidden">
      {/* Region Tabs + Volume Indicator (sticky header) */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white dark:bg-black">
        <div className="flex items-center border-b border-slate-200 dark:border-[#2f3336]">
          <div
            className="flex-1 flex items-center overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Feed filters"
          >
            {/* Inline tabs - responsive visibility */}
            {inlineTabs.map((tab) => {
              const isSelected = selectedTab === tab.id;
              const count = getTabCount(tab.id);

              // Responsive visibility classes
              let visibilityClass = '';
              if (tab.minScreen === 'sm') visibilityClass = 'hidden sm:flex';
              else if (tab.minScreen === 'md') visibilityClass = 'hidden md:flex';
              else if (tab.minScreen === 'lg') visibilityClass = 'hidden lg:flex';

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="feed-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`
                    relative flex-shrink-0 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium
                    transition-colors duration-200 whitespace-nowrap min-h-[44px]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
                    ${visibilityClass || 'flex'}
                    ${isSelected
                      ? 'text-slate-900 dark:text-[#e7e9ea]'
                      : 'text-slate-500 dark:text-[#71767b] hover:text-slate-700 dark:hover:text-[#e7e9ea] hover:bg-slate-50 dark:hover:bg-[#16181c]'
                    }
                  `}
                >
                  {tab.label}

                  {count > 0 && tab.id !== 'all' && (
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

            {/* More dropdown - always visible */}
            <div className="relative" ref={moreDropdownRef}>
              <button
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                className={`
                  relative flex items-center gap-1 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium
                  transition-colors duration-200 whitespace-nowrap min-h-[44px]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
                  ${isDropdownTabSelected
                    ? 'text-slate-900 dark:text-[#e7e9ea]'
                    : 'text-slate-500 dark:text-[#71767b] hover:text-slate-700 dark:hover:text-[#e7e9ea] hover:bg-slate-50 dark:hover:bg-[#16181c]'
                  }
                `}
                aria-expanded={moreDropdownOpen}
                aria-haspopup="true"
              >
                {isDropdownTabSelected
                  ? dropdownTabs.find(t => t.id === selectedTab)?.label
                  : 'Regional'}
                {/* Count badge for dropdown items */}
                {!isDropdownTabSelected && (() => {
                  const moreCount = dropdownTabs.reduce((sum, tab) => sum + getTabCount(tab.id), 0);
                  return moreCount > 0 ? (
                    <span className="ml-1.5 px-1.5 py-0.5 text-2xs sm:text-xs rounded-full bg-slate-100 dark:bg-[#2f3336] text-slate-500 dark:text-[#71767b]">
                      {moreCount}
                    </span>
                  ) : null;
                })()}
                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                {isDropdownTabSelected && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>

              {/* Dropdown menu */}
              {moreDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 py-1 bg-white dark:bg-[#16181c] border border-slate-200 dark:border-[#2f3336] rounded-lg shadow-lg z-50 min-w-[160px]">
                  <div className="flex flex-col p-1">
                    {/* Show regional tabs that are hidden on current screen size */}
                    {allTabs.filter(t => !t.alwaysVisible).map((tab) => {
                      const isSelected = selectedTab === tab.id;
                      const count = getTabCount(tab.id);

                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            handleTabSelect(tab.id);
                            setMoreDropdownOpen(false);
                          }}
                          className={`
                            px-3 py-2 text-sm font-medium rounded-md transition-colors text-left
                            ${isSelected
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              : 'text-slate-600 dark:text-[#e7e9ea] hover:bg-slate-100 dark:hover:bg-[#2f3336]'
                            }
                          `}
                        >
                          {tab.label}
                          {count > 0 && (
                            <span className={`ml-1.5 text-xs ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

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

        {/* Platform filter pills */}
        {(platformCounts.bluesky > 0 || platformCounts.rss > 0) && (
          <div className="px-3 py-2 flex items-center gap-1.5 border-b border-slate-100 dark:border-[#2f3336] bg-slate-50/50 dark:bg-[#16181c]/50">
            <span className="text-xs text-slate-500 dark:text-[#71767b] mr-1">Source:</span>
            {platformFilters.map((filter) => {
              const isSelected = platformFilter === filter.id;
              const count = filter.id === 'all'
                ? (platformCounts.bluesky || 0) + (platformCounts.rss || 0)
                : (platformCounts[filter.id] || 0);

              // Don't show filter if no items for that platform
              if (filter.id !== 'all' && count === 0) return null;

              return (
                <button
                  key={filter.id}
                  onClick={() => setPlatformFilter(filter.id)}
                  className={`
                    px-2.5 py-1 text-xs font-medium rounded-full transition-colors
                    ${isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-[#2f3336] text-slate-600 dark:text-[#71767b] hover:bg-slate-200 dark:hover:bg-[#3a3f44]'
                    }
                  `}
                >
                  {filter.label}
                  <span className={`ml-1 ${isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-[#536471]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Volume indicator - part of sticky header (only for region tabs) */}
        {selectedTab !== 'main' && selectedTab !== 'all' && activity?.[selectedTab] && (
          <VolumeIndicator activity={activity[selectedTab]} />
        )}
      </div>

      <div id="feed-panel" role="tabpanel" aria-label={`News for ${selectedTab === 'main' ? 'main feed' : selectedTab === 'all' ? 'all regions' : selectedTab}`}>

        {/* AI Analysis Section - only show after news loads */}
        {!isLoading && sortedItems.length > 0 && (
          <>
            <div className="mt-3" />
            <InlineBriefing region={selectedTab === 'main' ? 'all' : selectedTab as WatchpointId} />
          </>
        )}

        {/* Status bar - shows data freshness and latency */}
        {!isLoading && sortedItems.length > 0 && (
          <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-slate-100 dark:border-[#2f3336] bg-slate-50/50 dark:bg-[#16181c]/50">
            <span className="text-slate-500 dark:text-[#71767b]">
              {sortedItems.length} updates {selectedTab === 'main' ? 'in Main feed' : selectedTab !== 'all' && `in ${regionDisplayNames[selectedTab as WatchpointId]}`}
            </span>
            <div className="flex items-center gap-3">
              {loadTimeMs != null && (
                <span className={loadTimeMs > 10000 ? 'text-amber-500' : 'text-slate-400 dark:text-[#536471]'}>
                  {loadTimeMs > 1000 ? `${(loadTimeMs / 1000).toFixed(1)}s` : `${loadTimeMs}ms`}
                </span>
              )}
              {lastUpdated && (
                <span className="text-slate-400 dark:text-[#536471]" suppressHydrationWarning>
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
              {selectedTab === 'main'
                ? 'High-impact stories will appear here'
                : selectedTab === 'all'
                ? 'News will appear here as it breaks'
                : `No news for ${regionDisplayNames[selectedTab as WatchpointId] || 'this region'} yet`}
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

        <div className="flex flex-col gap-3 p-3 sm:p-4 news-feed-list">
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
