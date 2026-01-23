'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon, ShareIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon as CheckBadgeSolid } from '@heroicons/react/24/solid';
import { NewsItem, WatchpointId } from '@/types';
import { PlatformIcon, platformColors } from './PlatformIcon';

interface NewsCardProps {
  item: NewsItem;
}

// Character limit for truncation
const CHAR_LIMIT = 280;

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

// Human-readable source type labels
const sourceTypeLabels: Record<string, string> = {
  official: 'Official',
  'news-org': 'News Org',
  osint: 'OSINT',
  reporter: 'Reporter',
  analyst: 'Analyst',
  aggregator: 'Aggregator',
  ground: 'Ground',
  bot: 'Bot',
};

// Source avatar component - simple avatar or platform icon fallback
function SourceAvatar({
  avatarUrl,
  platform,
  name,
  platformColor,
}: {
  avatarUrl?: string;
  platform: string;
  name: string;
  platformColor: string;
}) {
  const [imgError, setImgError] = useState(false);

  // Show avatar if available and not errored
  if (avatarUrl && !imgError) {
    return (
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-600 flex-shrink-0">
        <Image
          src={avatarUrl}
          alt={`${name} avatar`}
          fill
          sizes="32px"
          className="object-cover"
          onError={() => setImgError(true)}
          unoptimized // External images
        />
      </div>
    );
  }

  // Fallback: show platform icon
  return (
    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
      <span className={platformColor}>
        <PlatformIcon platform={platform} className="w-4 h-4" />
      </span>
    </div>
  );
}

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
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  // For older items, show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NewsCard({ item }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const platformColor = platformColors[item.source.platform] || platformColors.rss;
  const sourceTypeStyle = sourceTypeColors[item.source.sourceType] || sourceTypeColors.osint;
  const sourceTypeLabel = sourceTypeLabels[item.source.sourceType] || item.source.sourceType;
  const isVerified = item.verificationStatus === 'confirmed';
  const regionBadge = regionBadges[item.region] || regionBadges['all'];

  // Check if text needs truncation
  const needsTruncation = item.title.length > CHAR_LIMIT;
  const displayText = useMemo(() => {
    if (!needsTruncation || isExpanded) return item.title;
    // Truncate at word boundary
    const truncated = item.title.slice(0, CHAR_LIMIT);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > CHAR_LIMIT - 50 ? truncated.slice(0, lastSpace) : truncated;
  }, [item.title, needsTruncation, isExpanded]);

  const handleOpenSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareText = `${item.title}${item.url ? `\n\n${item.url}` : ''}`;
    const shareData = {
      title: item.source.name,
      text: item.title,
      url: item.url || '',
    };

    // Try native share first (works on mobile)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or error - fall through to fallback
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: show share options
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // On mobile without native share, try SMS
      const smsBody = encodeURIComponent(shareText);
      window.open(`sms:?body=${smsBody}`, '_blank');
    } else {
      // On desktop, use email
      const subject = encodeURIComponent(`${item.source.name}: ${item.title.slice(0, 50)}...`);
      const body = encodeURIComponent(shareText);
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <article
      className="
        relative px-3 py-3 sm:px-4 sm:py-4 bg-white dark:bg-slate-900 rounded-xl
        border border-slate-200/80 dark:border-slate-800
        hover:border-slate-300 dark:hover:border-slate-600
        transition-all duration-200
      "
    >
      <div className="flex flex-col gap-2">
        {/* Row 1: Avatar + Name + Time | Region */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <SourceAvatar
              avatarUrl={item.source.avatarUrl}
              platform={item.source.platform}
              name={item.source.name}
              platformColor={platformColor}
            />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {item.source.name}
              </span>
              {isVerified && (
                <CheckBadgeSolid className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0" suppressHydrationWarning>
                · {formatTimeAgo(item.timestamp)} · {item.timestamp.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </div>
          </div>
          {/* Region badge */}
          <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md flex-shrink-0 ${regionBadge.color}`}>
            {regionBadge.label}
          </span>
        </div>

        {/* Row 2: Message text with truncation */}
        <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed py-2">
          <p>
            {displayText}
            {needsTruncation && !isExpanded && (
              <>
                <span className="text-slate-400">...</span>
                <button
                  onClick={handleToggleExpand}
                  className="ml-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Show more
                </button>
              </>
            )}
            {needsTruncation && isExpanded && (
              <button
                onClick={handleToggleExpand}
                className="ml-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Show less
              </button>
            )}
          </p>
        </div>

        {/* Row 3: Tags + Actions */}
        <div className="flex items-center justify-between pt-1">
          {/* Source type badges */}
          <div className="flex items-center gap-2.5">
            <span className={`px-1.5 py-0.5 text-2xs font-medium rounded border ${sourceTypeStyle}`}>
              {sourceTypeLabel}
            </span>
            <span className={`flex items-center gap-1 px-1.5 py-0.5 text-2xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${platformColor}`}>
              <PlatformIcon platform={item.source.platform} className="w-3 h-3" />
              <span className="capitalize">{item.source.platform}</span>
            </span>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              aria-label="Share this post"
            >
              <ShareIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Share</span>
            </button>
            {item.url && (
              <button
                onClick={handleOpenSource}
                className="flex items-center gap-1.5 text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors"
                aria-label="Open source"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                <span className="text-xs font-medium">Source</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
