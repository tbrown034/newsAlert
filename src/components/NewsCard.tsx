'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon as CheckBadgeSolid } from '@heroicons/react/24/solid';
import { NewsItem } from '@/types';
import { PlatformIcon, platformColors } from './PlatformIcon';

interface NewsCardProps {
  item: NewsItem;
}

// Source type colors - Light/Dark theme
const tierColors: Record<string, string> = {
  official: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
  osint: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
  reporter: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  ground: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function NewsCard({ item }: NewsCardProps) {
  const platformColor = platformColors[item.source.platform] || platformColors.rss;
  const tierStyle = tierColors[item.source.tier] || tierColors.osint;
  const isVerified = item.verificationStatus === 'confirmed';

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
        relative px-3 py-3 sm:px-4 sm:py-3.5 bg-white dark:bg-[#16181c] rounded-lg border border-slate-200 dark:border-[#2f3336]
        hover:border-slate-300 dark:hover:border-[#536471] hover:shadow-sm dark:hover:bg-[#1c1f23]
        transition-all duration-200 cursor-pointer group
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black
      "
      onClick={handleOpenSource}
      onKeyDown={handleKeyDown}
    >
      {/* Two-column layout: Source on left, Content on right */}
      <div className="flex gap-2 sm:gap-3">
        {/* Left column: Source info */}
        <div className="flex-shrink-0 w-28 sm:w-36">
          <div className="flex flex-col gap-1.5">
            {/* Platform icon + name */}
            <div className="flex items-center gap-1.5">
              <span className={platformColor}>
                <PlatformIcon platform={item.source.platform} className="w-4 h-4" />
              </span>
              {item.source.platform === 'bluesky' && (
                <span className="text-2xs text-[#0085ff] font-medium">Bluesky</span>
              )}
              {isVerified && (
                <CheckBadgeSolid className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>
            {/* Source name on its own line */}
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-[#e7e9ea] line-clamp-2 leading-tight">
                {item.source.name}
              </span>
            </div>

            {/* Tier badge + time */}
            <div className="flex items-center gap-1.5">
              <span className={`px-1 py-0.5 text-2xs font-medium rounded border ${tierStyle}`}>
                {item.source.tier.toUpperCase()}
              </span>
              <span className="text-2xs text-slate-400">
                {formatTimeAgo(item.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Content */}
        <div className="flex-1 min-w-0">
          {/* Main message content */}
          <p className="text-sm text-slate-800 dark:text-[#e7e9ea] leading-relaxed">
            {item.title}
          </p>

          {/* Footer row: Media + External Link */}
          <div className="flex items-center justify-end gap-2 mt-2">
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
