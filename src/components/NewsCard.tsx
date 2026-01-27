'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon, ShareIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon as CheckBadgeSolid } from '@heroicons/react/24/solid';
import { NewsItem, WatchpointId, MediaAttachment } from '@/types';
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

// External link card component (for article links, embeds)
function ExternalLinkCard({ link }: { link: MediaAttachment }) {
  const [imgError, setImgError] = useState(false);

  // Extract domain from URL for display
  const domain = (() => {
    try {
      return new URL(link.url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors bg-slate-50 dark:bg-slate-800/50"
    >
      {/* Thumbnail */}
      {link.thumbnail && !imgError && (
        <div className="relative w-24 sm:w-32 flex-shrink-0">
          <Image
            src={link.thumbnail}
            alt={link.title || 'Link preview'}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized
          />
        </div>
      )}
      {/* Content */}
      <div className="flex-1 p-2.5 sm:p-3 min-w-0 flex flex-col justify-center">
        {link.title && (
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
            {link.title}
          </p>
        )}
        {link.alt && !link.title && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
            {link.alt}
          </p>
        )}
        {domain && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            {domain}
          </p>
        )}
      </div>
    </a>
  );
}

// Media display component for images/videos/links
function MediaDisplay({ media }: { media: MediaAttachment[] }) {
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  if (!media || media.length === 0) return null;

  // Separate visual media from external links
  const visualMedia = media.filter(m => m.type === 'image' || m.type === 'video');
  const externalLinks = media.filter(m => m.type === 'external');

  const handleImageError = (index: number) => {
    setFailedImages(prev => new Set(prev).add(index));
  };

  return (
    <>
      {/* Visual media (images/videos) */}
      {visualMedia.length === 1 && !failedImages.has(0) && (
        <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <a
            href={visualMedia[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative"
          >
            <Image
              src={visualMedia[0].thumbnail || visualMedia[0].url}
              alt={visualMedia[0].alt || 'Media attachment'}
              width={400}
              height={300}
              className="w-full h-auto max-h-72 object-cover"
              onError={() => handleImageError(0)}
              unoptimized
            />
            {visualMedia[0].type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
          </a>
        </div>
      )}

      {/* Multiple images: 2x2 grid */}
      {visualMedia.length > 1 && (
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          {visualMedia.slice(0, 4).map((item, index) => {
            if (failedImages.has(index)) return null;
            return (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square"
              >
                <Image
                  src={item.thumbnail || item.url}
                  alt={item.alt || `Image ${index + 1}`}
                  fill
                  className="object-cover"
                  onError={() => handleImageError(index)}
                  unoptimized
                />
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                      <svg className="w-4 h-4 text-slate-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}

      {/* External links as cards */}
      {externalLinks.map((link, index) => (
        <ExternalLinkCard key={`link-${index}`} link={link} />
      ))}
    </>
  );
}

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
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  // Handle future timestamps (clock drift, timezone issues)
  // If post appears to be in the future, show "just now" -
  // this is common with RSS feeds that have timezone parsing issues
  if (seconds < 0) {
    // If more than 5 minutes in the future, something is wrong - still show "just now"
    // to avoid confusing negative time displays
    return 'just now';
  }

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
        {/* Repost indicator */}
        {item.repostContext && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 -mb-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>
              <span className="font-medium">{item.source.name}</span> reposted
            </span>
          </div>
        )}

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
                {item.repostContext ? item.repostContext.originalAuthor : item.source.name}
              </span>
              {isVerified && !item.repostContext && (
                <CheckBadgeSolid className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
              {item.source.isStateSponsored && (
                <span
                  className="flex items-center gap-0.5 px-1 py-0.5 text-2xs font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 flex-shrink-0"
                  title="State-sponsored media"
                >
                  <BuildingLibraryIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">State</span>
                </span>
              )}
              {item.repostContext?.originalHandle && (
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                  @{item.repostContext.originalHandle}
                </span>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0" suppressHydrationWarning>
                · {formatTimeAgo(item.timestamp)}
                <span className="hidden sm:inline"> · {item.timestamp.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}</span>
              </span>
            </div>
          </div>
          {/* Region badge */}
          <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md flex-shrink-0 ${regionBadge.color}`}>
            {regionBadge.label}
          </span>
        </div>

        {/* Reply context - show parent post for context */}
        {item.replyContext && (
          <div className="ml-10 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Replying to</span>
              <span className="text-blue-500 dark:text-blue-400 font-medium">
                @{item.replyContext.parentHandle || item.replyContext.parentAuthor}
              </span>
            </div>
            {/* Show parent text if available */}
            {item.replyContext.parentText && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                &ldquo;{item.replyContext.parentText}&rdquo;
              </p>
            )}
          </div>
        )}

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

        {/* Media attachments */}
        {item.media && item.media.length > 0 && (
          <MediaDisplay media={item.media} />
        )}

        {/* Article link card for RSS/news items (not social media) */}
        {item.url && item.source.platform === 'rss' && !item.media?.length && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Read full article
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                {(() => {
                  try {
                    return new URL(item.url).hostname.replace('www.', '');
                  } catch {
                    return item.url;
                  }
                })()}
              </p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" />
          </a>
        )}

        {/* Row 3: Tags + Actions */}
        <div className="flex items-center justify-between pt-1">
          {/* Combined source badge: "Reporter · Bluesky" */}
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center gap-1.5 px-1.5 py-0.5 text-2xs font-medium rounded border ${sourceTypeStyle}`}>
              {sourceTypeLabel}
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <PlatformIcon platform={item.source.platform} className="w-3 h-3" />
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
