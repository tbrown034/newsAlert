// Editorial post types for admin-injected content

import { WatchpointId } from './index';

export type EditorialPostType = 'breaking' | 'context' | 'event' | 'pinned';

export interface EditorialPost {
  id: string;
  title: string;
  content?: string;
  url?: string;
  postType: EditorialPostType;
  region: WatchpointId | null; // null = global (shows in all regions)
  pinOrder: number;
  startsAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
  mediaUrl?: string;
  internalNote?: string;
}

export interface EditorialPostCreate {
  title: string;
  content?: string;
  url?: string;
  postType: EditorialPostType;
  region?: WatchpointId | null;
  pinOrder?: number;
  startsAt?: Date;
  expiresAt?: Date;
  mediaUrl?: string;
  internalNote?: string;
}

export interface EditorialPostUpdate {
  title?: string;
  content?: string;
  url?: string;
  postType?: EditorialPostType;
  region?: WatchpointId | null;
  pinOrder?: number;
  startsAt?: Date;
  expiresAt?: Date;
  isActive?: boolean;
  mediaUrl?: string;
  internalNote?: string;
}
