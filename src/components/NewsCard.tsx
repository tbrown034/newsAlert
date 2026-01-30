'use client';

import { useState, useMemo, memo } from 'react';
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

// Source type colors - all neutral to avoid color overload
const sourceTypeColors: Record<string, string> = {
  official: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  'news-org': 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  osint: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  reporter: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  analyst: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  aggregator: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  ground: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  bot: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

// Platform display names
const platformNames: Record<string, string> = {
  bluesky: 'Bluesky',
  rss: 'RSS',
  telegram: 'Telegram',
  reddit: 'Reddit',
  youtube: 'YouTube',
  mastodon: 'Mastodon',
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

// External link card component (for article links, embeds) - compact design
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
      className="mt-2 flex items-center gap-2.5 p-2 rounded-md border border-[var(--border-light)] hover:border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors group"
    >
      {/* Small thumbnail */}
      {link.thumbnail && !imgError && (
        <div className="relative w-10 h-10 rounded flex-shrink-0 overflow-hidden bg-[var(--background-secondary)]">
          <Image
            src={link.thumbnail}
            alt=""
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized
          />
        </div>
      )}
      {/* Content - single line */}
      <div className="flex-1 min-w-0">
        {link.title && (
          <p className="text-label text-[var(--foreground)] truncate leading-tight">
            {link.title}
          </p>
        )}
        {domain && (
          <p className="text-caption text-[var(--foreground-light)] flex items-center gap-1">
            <ArrowTopRightOnSquareIcon className="w-3 h-3 opacity-60" />
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

// Region badge colors - neutral, muted to avoid color overload
// Color only for semantic meaning (breaking/elevated), not categorization
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

export const NewsCard = memo(function NewsCard({ item }: NewsCardProps) {
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
      className={`
        relative px-3 py-3 sm:px-4 sm:py-4
        bg-[var(--background-card)] rounded-xl
        border border-[var(--border-light)]
        hover:border-[var(--border)]
        transition-all duration-200
      `}
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
              <span className="text-label font-medium text-[var(--foreground)] truncate">
                {item.repostContext ? item.repostContext.originalAuthor : item.source.name}
              </span>
              {isVerified && !item.repostContext && (
                <CheckBadgeSolid className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
              )}
              {item.source.isStateSponsored && (
                <span
                  className="flex items-center gap-0.5 px-1 py-0.5 text-micro font-medium rounded bg-[var(--color-elevated-muted)] text-[var(--color-elevated)] flex-shrink-0"
                  title="State-sponsored media"
                >
                  <BuildingLibraryIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">State</span>
                </span>
              )}
              {item.repostContext?.originalHandle && (
                <span className="text-caption text-[var(--foreground-light)] truncate">
                  @{item.repostContext.originalHandle}
                </span>
              )}
              <span className="text-caption text-[var(--foreground-light)] flex-shrink-0" suppressHydrationWarning>
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
          <div className="ml-10 pl-3 border-l-2 border-[var(--border)]">
            <div className="flex items-center gap-1 text-caption text-[var(--foreground-light)] mb-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Replying to</span>
              <span className="text-[var(--foreground-muted)] font-medium">
                @{item.replyContext.parentHandle || item.replyContext.parentAuthor}
              </span>
            </div>
            {/* Show parent text if available */}
            {item.replyContext.parentText && (
              <p className="text-caption text-[var(--foreground-light)] line-clamp-2 italic">
                &ldquo;{item.replyContext.parentText}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Row 2: Message text with truncation - body text style */}
        <div className="text-body py-1">
          <p className="text-[var(--foreground)]">
            {displayText}
            {needsTruncation && !isExpanded && (
              <>
                <span className="text-[var(--foreground-light)]">...</span>
                <button
                  onClick={handleToggleExpand}
                  className="ml-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] font-medium"
                >
                  more
                </button>
              </>
            )}
            {needsTruncation && isExpanded && (
              <button
                onClick={handleToggleExpand}
                className="ml-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] font-medium"
              >
                less
              </button>
            )}
          </p>
        </div>

        {/* Media attachments */}
        {item.media && item.media.length > 0 && (
          <MediaDisplay media={item.media} />
        )}

        {/* Article link for RSS/news items - minimalist inline style */}
        {item.url && item.source.platform === 'rss' && !item.media?.length && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-caption text-[var(--foreground-light)] hover:text-[var(--foreground)] transition-colors group w-fit"
          >
            <span className="border-b border-dotted border-current">
              {(() => {
                try {
                  return new URL(item.url).hostname.replace('www.', '');
                } catch {
                  return 'Read article';
                }
              })()}
            </span>
            <ArrowTopRightOnSquareIcon className="w-3 h-3 opacity-60 group-hover:opacity-100" />
          </a>
        )}

        {/* Row 3: Tags + Actions */}
        <div className="flex items-center justify-between pt-1">
          {/* Source type (neutral) + Platform (icon + name) */}
          <div className="flex items-center gap-2.5">
            <span className={`px-1.5 py-0.5 text-micro font-medium rounded border ${sourceTypeStyle}`}>
              {sourceTypeLabel}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium ${platformColors[item.source.platform] || platformColors.rss}`}>
              <PlatformIcon platform={item.source.platform} className="w-3.5 h-3.5" />
              <span>{platformNames[item.source.platform] || item.source.platform}</span>
            </span>
          </div>
          {/* Actions - neutral colors */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-[var(--foreground-light)] hover:text-[var(--foreground-muted)] transition-colors"
              aria-label="Share this post"
            >
              <ShareIcon className="w-4 h-4" />
              <span className="text-caption font-medium">Share</span>
            </button>
            {item.url && (
              <button
                onClick={handleOpenSource}
                className="flex items-center gap-1.5 text-[var(--foreground-light)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Open source"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                <span className="text-caption font-medium">Source</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});
