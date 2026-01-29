# Editorial Injection Feature Design

**Date:** 2026-01-29
**Status:** Ready for Implementation
**Author:** Trevor Brown

---

## Overview

Add an editorial injection system that allows the admin (Trevor) to post breaking news alerts, contextual notes, event reminders, and pinned updates directly into the Pulse dashboard. This transforms Pulse from a passive aggregator into an active editorial command center.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Built-in admin (not Bluesky) | Full control, no platform dependency |
| Storage | Neon PostgreSQL | Already connected, live editing without deploys |
| Visual treatment | Mixed by type | BREAKING=banner, CONTEXT=card, EVENT=scheduled, PINNED=sticky |
| Region scoping | Global or region-specific | Maximum editorial flexibility |
| Admin UI | Floating button + management page | Quick posting speed + full management |

## Post Types

| Type | Icon | Visual | Behavior |
|------|------|--------|----------|
| **BREAKING** | ExclamationTriangleIcon (red) | Red banner at top | Stays pinned until dismissed |
| **CONTEXT** | InformationCircleIcon (amber) | Amber-bordered card in feed | Sorted chronologically |
| **EVENT** | CalendarIcon (blue) | Blue card with countdown | Shows at `starts_at`, hides at `expires_at` |
| **PINNED** | BookmarkIcon (gold) | Gold card at top of region | Manual pin/unpin |

## Database Schema

```sql
CREATE TABLE editorial_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  title         TEXT NOT NULL,
  content       TEXT,
  url           TEXT,

  -- Type & Display
  post_type     TEXT NOT NULL CHECK (post_type IN ('breaking', 'context', 'event', 'pinned')),
  region        TEXT,                    -- NULL = global
  pin_order     INTEGER DEFAULT 0,

  -- Scheduling
  starts_at     TIMESTAMP,
  expires_at    TIMESTAMP,

  -- Metadata
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  created_by    TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,

  -- Optional
  media_url     TEXT,
  internal_note TEXT
);

CREATE INDEX idx_editorial_active ON editorial_posts(is_active, post_type);
CREATE INDEX idx_editorial_region ON editorial_posts(region) WHERE region IS NOT NULL;
CREATE INDEX idx_editorial_schedule ON editorial_posts(starts_at, expires_at) WHERE starts_at IS NOT NULL;
```

## TypeScript Types

```typescript
// src/types/editorial.ts

export type EditorialPostType = 'breaking' | 'context' | 'event' | 'pinned';

export interface EditorialPost {
  id: string;
  title: string;
  content?: string;
  url?: string;
  postType: EditorialPostType;
  region: string | null;  // null = global
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
  region?: string;
  pinOrder?: number;
  startsAt?: Date;
  expiresAt?: Date;
  mediaUrl?: string;
  internalNote?: string;
}
```

## API Endpoints

### GET /api/editorial
List all active editorial posts. Used by news API to merge into feed.

```typescript
// Response
{
  posts: EditorialPost[],
  total: number
}
```

### POST /api/editorial
Create new editorial post. Requires admin auth.

```typescript
// Request body: EditorialPostCreate
// Response: EditorialPost
```

### PUT /api/editorial/[id]
Update existing post. Requires admin auth.

### DELETE /api/editorial/[id]
Archive post (set `is_active = false`). Requires admin auth.

## Feed Integration

Modify `/api/news/route.ts` to:

1. Fetch editorial posts from DB (filtered by region, active, within schedule)
2. Merge with aggregated feed using priority order:
   - BREAKING posts (by created_at desc)
   - PINNED posts (by pin_order asc)
   - Chronological mix of CONTEXT + regular feed items
3. EVENT posts appear when `NOW() >= starts_at` and `NOW() < expires_at`

```typescript
// Pseudocode for merge logic
const editorial = await getActiveEditorialPosts(region);
const breaking = editorial.filter(p => p.postType === 'breaking');
const pinned = editorial.filter(p => p.postType === 'pinned').sort((a,b) => a.pinOrder - b.pinOrder);
const context = editorial.filter(p => p.postType === 'context');
const events = editorial.filter(p => p.postType === 'event' && isWithinSchedule(p));

// Final order: breaking → pinned → chronological(context + events + regular feed)
```

## UI Components

### EditorialFAB (Floating Action Button)
- Location: Bottom-right of main dashboard
- Visibility: Only when admin is logged in
- Action: Opens EditorialModal

### EditorialModal
- Quick-post form with fields:
  - Type selector (radio buttons with icons)
  - Title (required, text input)
  - Content (optional, textarea)
  - Region (dropdown: Global + all regions)
  - URL (optional, text input)
  - Schedule (for EVENT: start/end datetime pickers)
  - Expiration (optional datetime for auto-archive)
- Submit creates post via POST /api/editorial

### EditorialCard
- Renders editorial posts with type-specific styling
- BREAKING: Red background, ExclamationTriangleIcon, dismiss button
- CONTEXT: Amber border, InformationCircleIcon, "Editor Note" label
- EVENT: Blue border, CalendarIcon, countdown timer
- PINNED: Gold border, BookmarkIcon, "Pinned" label

### Admin Editorial Page (/admin/editorial)
- Table of all editorial posts (active + archived tabs)
- Columns: Type icon, Title, Region, Created, Status, Actions
- Actions: Edit, Archive/Restore, Delete permanently
- Bulk actions: Archive selected

## Files to Create/Modify

### New Files
1. `src/types/editorial.ts` - TypeScript types
2. `src/app/api/editorial/route.ts` - GET, POST endpoints
3. `src/app/api/editorial/[id]/route.ts` - PUT, DELETE endpoints
4. `src/lib/editorial.ts` - DB queries and helpers
5. `src/components/EditorialFAB.tsx` - Floating action button
6. `src/components/EditorialModal.tsx` - Quick-post form
7. `src/components/EditorialCard.tsx` - Type-specific card rendering
8. `src/app/admin/editorial/page.tsx` - Management dashboard

### Modified Files
1. `src/app/api/news/route.ts` - Merge editorial into feed
2. `src/components/NewsFeed.tsx` - Render editorial cards
3. `src/app/HomeClient.tsx` - Add EditorialFAB when admin
4. `src/types/index.ts` - Export editorial types

## Implementation Phases

### Phase 1: Database Foundation (1-2 hours)
- [ ] Create migration script for `editorial_posts` table
- [ ] Run migration on Neon
- [ ] Add TypeScript types

### Phase 2: API Layer (2-3 hours)
- [ ] Create /api/editorial endpoints (CRUD)
- [ ] Add auth middleware (reuse existing admin check)
- [ ] Modify /api/news to merge editorial posts

### Phase 3: Admin UI (3-4 hours)
- [ ] Create EditorialModal component
- [ ] Create EditorialFAB component
- [ ] Create /admin/editorial management page
- [ ] Integrate FAB into HomeClient

### Phase 4: Feed Display (2-3 hours)
- [ ] Create EditorialCard component with type variants
- [ ] Modify NewsFeed to render editorial cards
- [ ] Add BREAKING banner styling
- [ ] Add dismiss functionality

### Phase 5: Polish (1-2 hours)
- [ ] EVENT scheduling logic (show/hide based on time)
- [ ] Auto-expiration for all post types
- [ ] Cache invalidation on editorial changes
- [ ] Mobile responsive testing

## Verification Plan

1. **Database**: Run migration, verify table exists with correct schema
2. **API**: Test CRUD operations via curl/Postman
3. **Auth**: Verify non-admin cannot access editorial endpoints
4. **Feed merge**: Check editorial posts appear in correct order
5. **UI**: Create each post type, verify styling matches design
6. **Scheduling**: Create EVENT, verify it shows/hides at correct times
7. **Mobile**: Test FAB and modal on mobile viewport

## Future Enhancements (Not in Scope)

- Image/media uploads (currently URL only)
- Draft/preview mode
- Scheduled publishing (vs just scheduled display)
- Multiple admin users with different permissions
- Analytics on editorial post engagement
