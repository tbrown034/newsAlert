'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NewsItem, WatchpointId } from '@/types';
import { NewsCard } from './NewsCard';
import { EditorialCard, isEditorialItem } from './EditorialCard';
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
  onRefresh,
  activity,
  error,
  onRetry,
  lastUpdated,
  loadTimeMs,
  pendingCount = 0,
  onShowPending,
  autoUpdate = true,
  onToggleAutoUpdate,
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

  return (
    <div className="flex flex-col bg-[var(--background)]">
      {/* Region Tabs + Volume Indicator (sticky header) */}
      <div className="sticky top-14 sm:top-16 z-30 bg-[var(--background)]">
        <div className="flex items-center border-b border-[var(--border-light)]">
          {/* Scrollable tabs area */}
          <div
            className="flex items-center overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Feed filters"
          >
            {/* Inline tabs - responsive visibility */}
            {inlineTabs.map((tab) => {
              const isSelected = selectedTab === tab.id;

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
                    relative flex-shrink-0 px-3 sm:px-4 py-3 sm:py-3.5 text-label font-medium
                    transition-colors duration-200 whitespace-nowrap min-h-[44px]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-inset
                    ${visibilityClass || 'flex'}
                    ${isSelected
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--foreground-light)] hover:text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)]'
                    }
                  `}
                >
                  {tab.label}

                  {isSelected && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[var(--foreground)] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Regional toggle button */}
          <button
            onClick={() => setRegionalExpanded(!regionalExpanded)}
            className={`
              relative flex items-center gap-1 px-3 sm:px-4 py-3 sm:py-3.5 text-label font-medium
              transition-colors duration-200 whitespace-nowrap min-h-[44px]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-inset
              ${isDropdownTabSelected || regionalExpanded
                ? 'text-[var(--foreground)]'
                : 'text-[var(--foreground-light)] hover:text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)]'
              }
            `}
            aria-expanded={regionalExpanded}
          >
            {isDropdownTabSelected
              ? dropdownTabs.find(t => t.id === selectedTab)?.label
              : 'Regional'}
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${regionalExpanded ? 'rotate-180' : ''}`} />
            {isDropdownTabSelected && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[var(--foreground)] rounded-full" />
            )}
          </button>

          <div className="flex-1" /> {/* Spacer */}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              aria-label={isLoading ? 'Refreshing feed' : 'Refresh feed'}
              className="flex-shrink-0 px-3 py-3 min-h-[44px] text-[var(--foreground-light)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 border-l border-[var(--border-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-inset"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Expandable regional row */}
        {regionalExpanded && (
          <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-[var(--border-light)] bg-[var(--background-secondary)] overflow-x-auto scrollbar-hide">
            {/* Show first 3 regions inline on mobile, all on larger screens */}
            {allTabs.filter(t => !t.alwaysVisible).slice(0, 3).map((tab) => {
              const isSelected = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    handleTabSelect(tab.id);
                    setRegionalExpanded(false);
                  }}
                  className={`
                    px-2.5 sm:px-3 py-1.5 text-caption sm:text-label font-medium rounded-lg transition-colors whitespace-nowrap
                    ${isSelected
                      ? 'bg-[var(--background-card)] text-[var(--foreground)] border border-[var(--border)]'
                      : 'bg-[var(--background-card)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] border border-[var(--border-light)]'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* More dropdown for remaining regions on mobile */}
            <div className="relative sm:hidden" ref={moreDropdownRef}>
              <button
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
              >
                More
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 min-w-[140px]">
                  {allTabs.filter(t => !t.alwaysVisible).slice(3).map((tab) => {
                    const isSelected = selectedTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          handleTabSelect(tab.id);
                          setMoreDropdownOpen(false);
                          setRegionalExpanded(false);
                        }}
                        className={`
                          w-full px-3 py-2.5 text-sm font-medium transition-colors text-left
                          ${isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Show remaining regions inline on larger screens */}
            {allTabs.filter(t => !t.alwaysVisible).slice(3).map((tab) => {
              const isSelected = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    handleTabSelect(tab.id);
                    setRegionalExpanded(false);
                  }}
                  className={`
                    hidden sm:block px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
                    ${isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Platform filter bar - collapsible */}
        {(isLoading || Object.values(platformCounts).some(count => count > 0)) && (
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Collapsed state: just show toggle button */}
            {!sourceFilterExpanded ? (
              <>
                <button
                  onClick={() => setSourceFilterExpanded(true)}
                  className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                >
                  <span>Filter by source</span>
                  <ChevronDownIcon className="w-3 h-3" />
                </button>
                {/* Show active filter if not "all" */}
                {platformFilter !== 'all' && (
                  <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {platformFilters.find(f => f.id === platformFilter)?.label}
                    <button
                      onClick={() => setPlatformFilter('all')}
                      className="ml-1 text-blue-400 hover:text-blue-600"
                    >
                      ×
                    </button>
                  </span>
                )}
                {/* Stats + Live updates on right side */}
                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
                  <span>{Object.values(platformCounts).reduce((sum, c) => sum + c, 0)} posts</span>
                  {lastUpdated && (
                    <span className="hidden sm:inline" suppressHydrationWarning>
                      · {formatLastUpdated(lastUpdated)}
                    </span>
                  )}
                  {onToggleAutoUpdate && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <span>Live updates</span>
                      <button
                        onClick={onToggleAutoUpdate}
                        className={`relative w-8 h-5 rounded-full transition-colors ${
                          autoUpdate
                            ? 'bg-blue-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        aria-label={autoUpdate ? 'Disable live updates' : 'Enable live updates'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            autoUpdate ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Expanded state: show all platform filters */
              <>
                <button
                  onClick={() => setSourceFilterExpanded(false)}
                  className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <span>Source:</span>
                  <ChevronDownIcon className="w-3 h-3 rotate-180" />
                </button>
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  {platformFilters.map((filter) => {
                    const isSelected = platformFilter === filter.id;
                    const count = filter.id === 'all'
                      ? Object.values(platformCounts).reduce((sum, c) => sum + c, 0)
                      : (platformCounts[filter.id] || 0);

                    // Hide platforms with 0 items (except "All" and currently selected)
                    if (filter.id !== 'all' && count === 0 && !isSelected && !isLoading) {
                      return null;
                    }

                    // Show loading state if still loading initial data
                    const isLoadingPlatform = isLoading && filter.id !== 'all' && count === 0;

                    return (
                      <button
                        key={filter.id}
                        onClick={() => setPlatformFilter(filter.id)}
                        disabled={isLoadingPlatform}
                        className={`
                          px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full transition-colors whitespace-nowrap
                          ${isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }
                          ${isLoadingPlatform ? 'opacity-60' : ''}
                        `}
                      >
                        {filter.label}
                        {isLoadingPlatform ? (
                          <span className="ml-1 inline-block w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className={`ml-0.5 sm:ml-1 ${isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Stats on right side - hidden on mobile to reduce cramping */}
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
                  {loadTimeMs != null && (
                    <span className={loadTimeMs > 10000 ? 'text-amber-500' : ''}>
                      {loadTimeMs > 1000 ? `${(loadTimeMs / 1000).toFixed(1)}s` : `${loadTimeMs}ms`}
                    </span>
                  )}
                  {lastUpdated && (
                    <span suppressHydrationWarning>
                      {formatLastUpdated(lastUpdated)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Volume indicator - part of sticky header (only for region tabs) */}
        {selectedTab !== 'all' && activity?.[selectedTab] && (
          <VolumeIndicator activity={activity[selectedTab]} />
        )}

        {/* AI Summary Section - part of sticky header */}
        {!isLoading && sortedItems.length > 0 && (
          <InlineBriefing region={selectedTab} />
        )}
      </div>

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

        {/* New posts banner - shown when auto-update is OFF and items are pending */}
        {pendingCount > 0 && !autoUpdate && (
          <button
            onClick={onShowPending}
            className="mx-3 sm:mx-4 mt-3 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {pendingCount} new {pendingCount === 1 ? 'post' : 'posts'}
          </button>
        )}

        <div className="flex flex-col gap-4 px-3 sm:px-4 pb-3 sm:pb-4 pt-3 news-feed-list">
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

        {/* Pending items indicator when auto-update is ON */}
        {pendingCount > 0 && autoUpdate && (
          <div className="py-2 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Live updating...</span>
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
