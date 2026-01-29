'use client';

import { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
  BookmarkIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/solid';
import { NewsItem, WatchpointId } from '@/types';
import Image from 'next/image';

// Extended NewsItem type for editorial posts
interface EditorialNewsItem extends NewsItem {
  isEditorial: true;
  editorialType: 'breaking' | 'context' | 'event' | 'pinned';
}

interface EditorialCardProps {
  item: EditorialNewsItem;
  onDismiss?: (id: string) => void;
}

// Region badge colors
const regionBadges: Record<WatchpointId, { label: string; color: string }> = {
  'us': { label: 'US', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  'latam': { label: 'AMERICAS', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  'middle-east': { label: 'MIDEAST', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  'europe-russia': { label: 'EUR', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  'asia': { label: 'ASIA', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  'seismic': { label: 'SEISMIC', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  'all': { label: 'GLOBAL', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
};

// Style config per editorial type
const editorialStyles = {
  breaking: {
    icon: ExclamationTriangleIcon,
    label: 'ALERT',
    containerClass: 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800',
    headerClass: 'bg-red-100 dark:bg-red-900/50',
    iconClass: 'text-red-600 dark:text-red-400',
    labelClass: 'text-red-700 dark:text-red-300',
  },
  context: {
    icon: InformationCircleIcon,
    label: 'Editor Note',
    containerClass: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800',
    headerClass: 'bg-amber-100/50 dark:bg-amber-900/30',
    iconClass: 'text-amber-600 dark:text-amber-400',
    labelClass: 'text-amber-700 dark:text-amber-300',
  },
  event: {
    icon: CalendarIcon,
    label: 'Upcoming',
    containerClass: 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800',
    headerClass: 'bg-blue-100/50 dark:bg-blue-900/30',
    iconClass: 'text-blue-600 dark:text-blue-400',
    labelClass: 'text-blue-700 dark:text-blue-300',
  },
  pinned: {
    icon: BookmarkIcon,
    label: 'Pinned',
    containerClass: 'bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-400 dark:border-yellow-700',
    headerClass: 'bg-yellow-100/50 dark:bg-yellow-900/30',
    iconClass: 'text-yellow-600 dark:text-yellow-500',
    labelClass: 'text-yellow-700 dark:text-yellow-400',
  },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Countdown timer for events
function useCountdown(targetDate?: Date): string | null {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('NOW');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setCountdown(`in ${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setCountdown(`in ${hours}h ${minutes}m`);
      } else {
        setCountdown(`in ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [targetDate]);

  return countdown;
}

export function EditorialCard({ item, onDismiss }: EditorialCardProps) {
  const style = editorialStyles[item.editorialType];
  const Icon = style.icon;
  const regionBadge = regionBadges[item.region] || regionBadges['all'];

  // For events, show countdown (using timestamp as the event time for now)
  // In reality, this would use startsAt from the editorial post
  const countdown = useCountdown(
    item.editorialType === 'event' ? item.timestamp : undefined
  );

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(item.id);
    }
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Breaking posts get a more prominent banner style
  if (item.editorialType === 'breaking') {
    return (
      <article
        className={`
          relative px-3 py-3 sm:px-4 sm:py-3 rounded-xl
          border-2 ${style.containerClass}
          transition-all duration-200
        `}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg ${style.headerClass}`}>
              <Icon className={`w-5 h-5 ${style.iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${style.labelClass}`}>
                  {style.label}
                </span>
                <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md ${regionBadge.color}`}>
                  {regionBadge.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                  {formatTimeAgo(item.timestamp)}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                {item.title}
              </p>
              {item.content && item.content !== item.title && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {item.content}
                </p>
              )}
              {item.url && (
                <button
                  onClick={handleOpenLink}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  View source
                </button>
              )}
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              aria-label="Dismiss alert"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </article>
    );
  }

  // Standard card style for context, event, and pinned
  return (
    <article
      className={`
        relative px-3 py-3 sm:px-4 sm:py-4 rounded-xl
        border ${style.containerClass}
        transition-all duration-200
      `}
    >
      <div className="flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${style.headerClass}`}>
              <Icon className={`w-4 h-4 ${style.iconClass}`} />
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${style.labelClass}`}>
              {style.label}
            </span>
            {item.editorialType === 'event' && countdown && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white">
                {countdown}
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
              {formatTimeAgo(item.timestamp)}
            </span>
          </div>
          <span className={`px-1.5 py-0.5 text-2xs font-semibold rounded-md ${regionBadge.color}`}>
            {regionBadge.label}
          </span>
        </div>

        {/* Content */}
        <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
          <p className="font-medium">{item.title}</p>
          {item.content && item.content !== item.title && (
            <p className="mt-1 text-slate-600 dark:text-slate-300">{item.content}</p>
          )}
        </div>

        {/* Media */}
        {item.media && item.media.length > 0 && item.media[0].type === 'image' && (
          <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <Image
              src={item.media[0].url}
              alt=""
              width={400}
              height={200}
              className="w-full h-auto max-h-48 object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Link */}
        {item.url && (
          <button
            onClick={handleOpenLink}
            className={`inline-flex items-center gap-1.5 text-xs font-medium w-fit ${style.iconClass} hover:opacity-80 transition-opacity`}
          >
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            {item.editorialType === 'event' ? 'Watch' : 'Read more'}
          </button>
        )}
      </div>
    </article>
  );
}

// Type guard to check if a NewsItem is an editorial post
export function isEditorialItem(item: NewsItem): item is EditorialNewsItem {
  return 'isEditorial' in item && (item as EditorialNewsItem).isEditorial === true;
}
