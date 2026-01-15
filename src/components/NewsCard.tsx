'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon as CheckBadgeSolid } from '@heroicons/react/24/solid';
import { NewsItem } from '@/types';
import { getActivityIndicator } from '@/lib/activityDetection';
import { getSeverityIndicator, getEventTypeLabel } from '@/lib/keywordDetection';
import { analyzeMessage, contentTypeDisplay, verificationDisplay, provenanceDisplay } from '@/lib/messageAnalysis';
import { PlatformIcon, platformColors } from './PlatformIcon';

interface NewsCardProps {
  item: NewsItem;
}

// Source type colors - Light theme
const tierColors: Record<string, string> = {
  official: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  osint: 'bg-amber-100 text-amber-700 border-amber-200',
  reporter: 'bg-blue-100 text-blue-700 border-blue-200',
  ground: 'bg-orange-100 text-orange-700 border-orange-200',
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

  // Activity detection
  const activityIndicator = item.sourceActivity ? getActivityIndicator(item.sourceActivity) : null;

  // Event severity
  const eventSignal = item.eventSignal;
  const showSeverity = eventSignal && eventSignal.severity !== 'routine';
  const severityIndicator = showSeverity ? getSeverityIndicator(eventSignal.severity) : null;
  const eventTypeLabel = eventSignal ? getEventTypeLabel(eventSignal.type) : null;

  // Message-level analysis
  const messageAnalysis = analyzeMessage(item.title + ' ' + (item.content || ''));
  const ctStyle = contentTypeDisplay[messageAnalysis.contentType.type];
  const vStyle = verificationDisplay[messageAnalysis.verification.level];
  const pStyle = provenanceDisplay[messageAnalysis.provenance.type];
  const showMessageIndicators = messageAnalysis.contentType.type !== 'general' ||
    messageAnalysis.verification.confidence > 0.5 ||
    messageAnalysis.provenance.confidence > 0.5;

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

  // Determine card accent based on severity - Light theme
  const getCardAccent = () => {
    if (eventSignal?.severity === 'critical') return 'border-l-4 border-l-red-500 bg-red-50/50';
    if (eventSignal?.severity === 'high') return 'border-l-4 border-l-orange-500 bg-orange-50/50';
    if (eventSignal?.severity === 'moderate') return 'border-l-4 border-l-amber-400/60';
    return '';
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${item.title}. From ${item.source.name}. Click to open source.`}
      className={`
        relative px-3 py-3 sm:px-4 sm:py-3.5 bg-white dark:bg-[#16181c] rounded-lg border border-slate-200 dark:border-[#2f3336]
        hover:border-slate-300 dark:hover:border-[#536471] hover:shadow-sm dark:hover:bg-[#1c1f23]
        transition-all duration-200 cursor-pointer group
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black
        ${getCardAccent()}
      `}
      onClick={handleOpenSource}
      onKeyDown={handleKeyDown}
    >
      {/* Two-column layout: Source on left, Content on right */}
      <div className="flex gap-3">
        {/* Left column: Source info */}
        <div className="flex-shrink-0 w-24 sm:w-28">
          <div className="flex flex-col gap-1.5">
            {/* Platform icon + name */}
            <div className="flex items-center gap-1.5">
              <span className={platformColor}>
                <PlatformIcon platform={item.source.platform} className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-[#e7e9ea] truncate">
                {item.source.name}
              </span>
              {isVerified && (
                <CheckBadgeSolid className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>

            {/* Tier badge + time */}
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 text-2xs font-medium rounded border ${tierStyle}`}>
                {item.source.tier.toUpperCase()}
              </span>
              <span className="text-2xs text-slate-400">
                {formatTimeAgo(item.timestamp)}
              </span>
            </div>

            {/* Activity indicator */}
            {activityIndicator && (
              <div className={`flex items-center gap-1 text-2xs ${activityIndicator.color}`}>
                <span>{activityIndicator.icon}</span>
                <span className="font-medium">{activityIndicator.multiplier}× active</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Content */}
        <div className="flex-1 min-w-0">
          {/* Severity Banner for Critical/High */}
          {showSeverity && severityIndicator && (eventSignal?.severity === 'critical' || eventSignal?.severity === 'high') && (
            <div className={`flex items-center gap-2 mb-2 flex-wrap ${severityIndicator.color}`}>
              <span className={`px-2 py-0.5 rounded text-2xs font-bold ${severityIndicator.bgColor}`}>
                {severityIndicator.icon} {severityIndicator.label}
              </span>
              {eventTypeLabel && eventSignal?.type !== 'unknown' && (
                <span className="text-2xs text-slate-500">{eventTypeLabel}</span>
              )}
              {eventSignal?.isDeveloping && (
                <span className="text-2xs text-amber-600 italic">Developing</span>
              )}
              {eventSignal?.isConfirmed && (
                <span className="text-2xs text-emerald-600 font-medium">Confirmed</span>
              )}
            </div>
          )}

          {/* Main message content */}
          <p className="text-sm text-slate-800 dark:text-[#e7e9ea] leading-relaxed">
            {item.title}
          </p>

          {/* Moderate severity - subtle inline indicator */}
          {showSeverity && eventSignal?.severity === 'moderate' && (
            <div className="mt-1.5 flex items-center gap-1.5 text-2xs text-amber-600">
              <span>📢</span>
              <span>{eventTypeLabel || 'Notable'}</span>
              {eventSignal?.isDeveloping && <span className="italic">• Developing</span>}
            </div>
          )}

          {/* Message-level indicators */}
          {showMessageIndicators && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {messageAnalysis.contentType.type !== 'general' && (
                <span className={`px-1.5 py-0.5 text-2xs font-medium rounded ${ctStyle.bgColor} ${ctStyle.color}`}>
                  {ctStyle.label}
                </span>
              )}
              {messageAnalysis.verification.confidence > 0.5 && messageAnalysis.verification.level !== 'unverified' && (
                <span className={`text-2xs ${vStyle.color}`}>
                  {vStyle.icon} {vStyle.label}
                </span>
              )}
              {messageAnalysis.verification.level === 'unverified' && messageAnalysis.verification.confidence > 0.7 && (
                <span className={`text-2xs ${vStyle.color}`}>
                  {vStyle.icon} {vStyle.label}
                </span>
              )}
              {messageAnalysis.provenance.citedSources.length > 0 && (
                <span className={`text-2xs ${pStyle.color}`}>
                  via {messageAnalysis.provenance.citedSources.slice(0, 2).join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Footer row: Media + Link */}
          <div className="flex items-center justify-end gap-2 mt-2">
            {hasMedia && (
              <span className="text-2xs text-purple-500" title="Contains media">
                🖼
              </span>
            )}
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
          </div>
        </div>
      </div>
    </article>
  );
}
