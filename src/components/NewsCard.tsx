'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon as CheckBadgeSolid } from '@heroicons/react/24/solid';
import { NewsItem, WatchpointId } from '@/types';
import { PlatformIcon, platformColors } from './PlatformIcon';

interface NewsCardProps {
  item: NewsItem;
}

// Source type colors - Light/Dark theme
const sourceTypeColors: Record<string, string> = {
  official: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
  'news-org': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/50',
  osint: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
  reporter: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  analyst: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
  aggregator: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/50',
  ground: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
  bot: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800/50',
};

// Region badge colors and labels
const regionBadges: Record<WatchpointId, { label: string; color: string }> = {
  'us': { label: 'US', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  'latam': { label: 'AMERICAS', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  'middle-east': { label: 'MIDEAST', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  'europe-russia': { label: 'EUR', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  'asia': { label: 'ASIA', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  'seismic': { label: 'SEISMIC', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  'all': { label: 'GLOBAL', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  // For older items, show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NewsCard({ item }: NewsCardProps) {
  const platformColor = platformColors[item.source.platform] || platformColors.rss;
  const sourceTypeStyle = sourceTypeColors[item.source.sourceType] || sourceTypeColors.osint;
  const isVerified = item.verificationStatus === 'confirmed';
  const regionBadge = regionBadges[item.region] || regionBadges['all'];

  // Check if content likely has media (images, video links)
  const hasMedia = /\.(jpg|jpeg|png|gif|webp|mp4|webm)|youtube\.com|youtu\.be|twitter\.com\/.*\/(photo|video)/i.test(item.url || item.content);

  const handleOpenSource = () => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenSource();
    }
  };


  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${item.title}. From ${item.source.name}. Click to open source.`}
      className="
        relative px-3 py-3 sm:px-4 sm:py-4 bg-white dark:bg-[#16181c] rounded-xl
        border border-slate-200/80 dark:border-[#2f3336]
        hover:border-slate-300 dark:hover:border-[#536471]
        hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-none dark:hover:bg-[#1c1f23]
        transition-all duration-200 cursor-pointer group
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black
      "
      onClick={handleOpenSource}
      onKeyDown={handleKeyDown}
    >
      {/* Simplified single-column layout */}
      <div className="flex flex-col gap-2.5">
        {/* Header: Source info + Region badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={platformColor}>
              <PlatformIcon platform={item.source.platform} className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-[#e7e9ea] truncate">
              {item.source.name}
            </span>
            {isVerified && (
              <CheckBadgeSolid className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            )}
            <span className="text-2xs text-slate-400 dark:text-[#71767b]" suppressHydrationWarning>
              · {formatTimeAgo(item.timestamp)}
            </span>
            <span className="text-2xs text-slate-400 dark:text-[#71767b]" suppressHydrationWarning>
              · {item.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          {/* Region badge */}
          <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md ${regionBadge.color}`}>
            {regionBadge.label}
          </span>
        </div>

        {/* Main content */}
        <p className="text-sm text-slate-800 dark:text-[#e7e9ea] leading-relaxed">
          {item.title}
        </p>

        {/* Footer: Source type badge + Media + Link */}
        <div className="flex items-center justify-between">
          <span className={`px-1.5 py-0.5 text-2xs font-medium rounded-md border ${sourceTypeStyle}`}>
            {item.source.sourceType.toUpperCase()}
          </span>
          <div className="flex items-center gap-2">
            {hasMedia && (
              <span className="text-2xs text-purple-500" title="Contains media" aria-label="Contains media">
                🖼
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-2xs text-slate-400 dark:text-[#71767b] group-hover:text-blue-500 dark:group-hover:text-[#1d9bf0] transition-colors">
              <span className="sr-only">Opens in new tab</span>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
