'use client';

import { useState, useRef, useEffect } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
  BookmarkIcon,
} from '@heroicons/react/24/solid';
import { EditorialPostCreate, EditorialPostType } from '@/types/editorial';
import { WatchpointId } from '@/types';

interface EditorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EditorialPostCreate) => Promise<void>;
}

const postTypes: { value: EditorialPostType; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'breaking',
    label: 'Breaking',
    icon: ExclamationTriangleIcon,
    description: 'Urgent alert pinned to top',
  },
  {
    value: 'context',
    label: 'Context',
    icon: InformationCircleIcon,
    description: 'Background info in feed',
  },
  {
    value: 'event',
    label: 'Event',
    icon: CalendarIcon,
    description: 'Scheduled with countdown',
  },
  {
    value: 'pinned',
    label: 'Pinned',
    icon: BookmarkIcon,
    description: 'Sticky at top of region',
  },
];

const regions: { value: WatchpointId | ''; label: string }[] = [
  { value: '', label: 'Global (all regions)' },
  { value: 'us', label: 'United States' },
  { value: 'middle-east', label: 'Middle East' },
  { value: 'europe-russia', label: 'Europe & Russia' },
  { value: 'asia', label: 'Asia-Pacific' },
  { value: 'latam', label: 'Latin America' },
];

export function EditorialModal({ isOpen, onClose, onSubmit }: EditorialModalProps) {
  const [postType, setPostType] = useState<EditorialPostType>('breaking');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState<WatchpointId | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen && titleRef.current) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPostType('breaking');
      setTitle('');
      setContent('');
      setUrl('');
      setRegion('');
      setStartsAt('');
      setExpiresAt('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: EditorialPostCreate = {
        title: title.trim(),
        postType,
        content: content.trim() || undefined,
        url: url.trim() || undefined,
        region: region || undefined,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      };

      await onSubmit(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            New Editorial Post
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Post Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {postTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = postType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setPostType(type.value)}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {type.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {type.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                postType === 'breaking'
                  ? 'BREAKING: Explosion reported in...'
                  : postType === 'event'
                  ? 'State Dept briefing at 2pm ET'
                  : 'Enter headline...'
              }
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Content (optional) */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Details <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Additional context or details..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
            />
          </div>

          {/* URL (optional) */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Link <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Region */}
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value as WatchpointId | '')}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              {regions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event scheduling (only for EVENT type) */}
          {postType === 'event' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="startsAt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Starts at
                </label>
                <input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="expiresAt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expires at
                </label>
                <input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Expiration (for non-event types) */}
          {postType !== 'event' && (
            <div>
              <label htmlFor="expiresAt2" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Auto-expire <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="expiresAt2"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Post'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
