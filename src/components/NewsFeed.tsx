'use client';

import { NewsItem, WatchpointId } from '@/types';
import { NewsCard } from './NewsCard';
import { InlineBriefing } from './InlineBriefing';
import { SeismicFeed } from './SeismicFeed';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
  onRefresh?: () => void;
  activity?: Record<string, ActivityData>;
  error?: string | null;
  onRetry?: () => void;
}

// Skeleton loader for news cards - Light theme with shimmer
function NewsCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="px-4 py-4 border-b border-slate-100"
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

// Error state component - Light theme
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-6 p-4 bg-red-50 border border-red-200 rounded-xl">
      <div className="flex items-center gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-red-700 text-sm font-medium">Failed to load feed</p>
          <p className="text-red-500 text-xs mt-1 truncate">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
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
    <div className="px-4 py-3 flex items-center justify-between text-xs border-b border-slate-100 bg-slate-50/50">
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
  { id: 'ukraine-russia', label: 'Ukraine' },
  { id: 'china-taiwan', label: 'Taiwan' },
  { id: 'venezuela', label: 'Venezuela' },
  { id: 'us-domestic', label: 'US' },
  { id: 'seismic', label: 'Seismic', icon: '🌍' },
];

export function NewsFeed({
  items,
  selectedWatchpoint,
  onSelectWatchpoint,
  isLoading,
  onRefresh,
  activity,
  error,
  onRetry,
}: NewsFeedProps) {
  const filteredItems =
    selectedWatchpoint === 'all'
      ? items
      : items.filter((item) => item.region === selectedWatchpoint);

  const sortedItems = [...filteredItems].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const regionCounts = items.reduce((acc, item) => {
    acc[item.region] = (acc[item.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col bg-white rounded-xl overflow-hidden">
      {/* Region Tabs - Light theme */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="flex items-center flex-wrap sm:flex-nowrap sm:overflow-x-auto sm:scrollbar-hide">
          {regionTabs.map((tab) => {
            const isSelected = selectedWatchpoint === tab.id;
            const count = tab.id === 'all' ? items.length : (regionCounts[tab.id] || 0);

            return (
              <button
                key={tab.id}
                onClick={() => onSelectWatchpoint?.(tab.id)}
                className={`
                  relative px-2.5 sm:px-4 py-2.5 sm:py-3 text-2xs sm:text-sm font-medium
                  transition-colors duration-200 whitespace-nowrap
                  ${isSelected
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }
                `}
              >
                {tab.icon && <span className="mr-1">{tab.icon}</span>}
                {tab.label}

                {count > 0 && tab.id !== 'all' && tab.id !== 'seismic' && (
                  <span className={`
                    ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                    ${isSelected
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500'
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

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex-shrink-0 ml-auto px-3 py-3 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {selectedWatchpoint === 'seismic' ? (
        <SeismicFeed />
      ) : (
        <>
          {activity?.[selectedWatchpoint] && selectedWatchpoint !== 'all' && (
            <VolumeIndicator activity={activity[selectedWatchpoint]} />
          )}

          <InlineBriefing region={selectedWatchpoint} />

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
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <span className="text-2xl">📡</span>
              </div>
              <span className="text-slate-800 text-lg font-medium mb-1">No updates yet</span>
              <span className="text-slate-500 text-sm text-center">
                {selectedWatchpoint === 'all'
                  ? 'News will appear here as it breaks'
                  : `No news for ${regionTabs.find(t => t.id === selectedWatchpoint)?.label || 'this region'} yet`}
              </span>
            </div>
          )}

          <div className="flex flex-col divide-y divide-slate-100">
            {sortedItems.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>

          {isLoading && sortedItems.length > 0 && (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
