// Editorial posts database operations

import { query, queryOne } from './db';
import {
  EditorialPost,
  EditorialPostCreate,
  EditorialPostUpdate,
  EditorialPostType,
} from '@/types/editorial';
import { WatchpointId } from '@/types';

// Database row type (snake_case from PostgreSQL)
interface EditorialPostRow {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  post_type: EditorialPostType;
  region: WatchpointId | null;
  pin_order: number;
  starts_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  is_active: boolean;
  media_url: string | null;
  internal_note: string | null;
}

// Convert DB row to TypeScript interface
function rowToPost(row: EditorialPostRow): EditorialPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? undefined,
    url: row.url ?? undefined,
    postType: row.post_type,
    region: row.region,
    pinOrder: row.pin_order,
    startsAt: row.starts_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    isActive: row.is_active,
    mediaUrl: row.media_url ?? undefined,
    internalNote: row.internal_note ?? undefined,
  };
}

/**
 * Get all active editorial posts, optionally filtered by region
 * Respects scheduling (starts_at, expires_at)
 */
export async function getActiveEditorialPosts(
  region?: WatchpointId
): Promise<EditorialPost[]> {
  const now = new Date();

  let sql = `
    SELECT * FROM editorial_posts
    WHERE is_active = true
      AND (starts_at IS NULL OR starts_at <= $1)
      AND (expires_at IS NULL OR expires_at > $1)
  `;
  const params: unknown[] = [now];

  if (region && region !== 'all') {
    sql += ` AND (region IS NULL OR region = $2)`;
    params.push(region);
  }

  sql += ` ORDER BY
    CASE post_type
      WHEN 'breaking' THEN 1
      WHEN 'pinned' THEN 2
      ELSE 3
    END,
    pin_order ASC,
    created_at DESC`;

  const rows = await query<EditorialPostRow>(sql, params);
  return rows.map(rowToPost);
}

/**
 * Get all editorial posts (for admin management)
 */
export async function getAllEditorialPosts(
  includeArchived: boolean = false
): Promise<EditorialPost[]> {
  let sql = `SELECT * FROM editorial_posts`;

  if (!includeArchived) {
    sql += ` WHERE is_active = true`;
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = await query<EditorialPostRow>(sql);
  return rows.map(rowToPost);
}

/**
 * Get a single editorial post by ID
 */
export async function getEditorialPostById(
  id: string
): Promise<EditorialPost | null> {
  const row = await queryOne<EditorialPostRow>(
    `SELECT * FROM editorial_posts WHERE id = $1`,
    [id]
  );
  return row ? rowToPost(row) : null;
}

/**
 * Create a new editorial post
 */
export async function createEditorialPost(
  data: EditorialPostCreate,
  createdBy: string
): Promise<EditorialPost> {
  const row = await queryOne<EditorialPostRow>(
    `INSERT INTO editorial_posts (
      title, content, url, post_type, region, pin_order,
      starts_at, expires_at, created_by, media_url, internal_note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      data.title,
      data.content ?? null,
      data.url ?? null,
      data.postType,
      data.region ?? null,
      data.pinOrder ?? 0,
      data.startsAt ?? null,
      data.expiresAt ?? null,
      createdBy,
      data.mediaUrl ?? null,
      data.internalNote ?? null,
    ]
  );

  if (!row) {
    throw new Error('Failed to create editorial post');
  }

  return rowToPost(row);
}

/**
 * Update an editorial post
 */
export async function updateEditorialPost(
  id: string,
  data: EditorialPostUpdate
): Promise<EditorialPost | null> {
  // Build dynamic UPDATE query
  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    params.push(data.title);
  }
  if (data.content !== undefined) {
    updates.push(`content = $${paramIndex++}`);
    params.push(data.content);
  }
  if (data.url !== undefined) {
    updates.push(`url = $${paramIndex++}`);
    params.push(data.url);
  }
  if (data.postType !== undefined) {
    updates.push(`post_type = $${paramIndex++}`);
    params.push(data.postType);
  }
  if (data.region !== undefined) {
    updates.push(`region = $${paramIndex++}`);
    params.push(data.region);
  }
  if (data.pinOrder !== undefined) {
    updates.push(`pin_order = $${paramIndex++}`);
    params.push(data.pinOrder);
  }
  if (data.startsAt !== undefined) {
    updates.push(`starts_at = $${paramIndex++}`);
    params.push(data.startsAt);
  }
  if (data.expiresAt !== undefined) {
    updates.push(`expires_at = $${paramIndex++}`);
    params.push(data.expiresAt);
  }
  if (data.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    params.push(data.isActive);
  }
  if (data.mediaUrl !== undefined) {
    updates.push(`media_url = $${paramIndex++}`);
    params.push(data.mediaUrl);
  }
  if (data.internalNote !== undefined) {
    updates.push(`internal_note = $${paramIndex++}`);
    params.push(data.internalNote);
  }

  if (updates.length === 0) {
    return getEditorialPostById(id);
  }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const row = await queryOne<EditorialPostRow>(
    `UPDATE editorial_posts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return row ? rowToPost(row) : null;
}

/**
 * Archive (soft delete) an editorial post
 */
export async function archiveEditorialPost(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE editorial_posts SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  return Array.isArray(result);
}

/**
 * Restore an archived editorial post
 */
export async function restoreEditorialPost(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE editorial_posts SET is_active = true, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  return Array.isArray(result);
}

/**
 * Permanently delete an editorial post
 */
export async function deleteEditorialPost(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM editorial_posts WHERE id = $1`,
    [id]
  );
  return Array.isArray(result);
}

/**
 * Get counts by type for admin dashboard
 */
export async function getEditorialStats(): Promise<{
  total: number;
  active: number;
  archived: number;
  byType: Record<EditorialPostType, number>;
}> {
  const countRows = await query<{ is_active: boolean; count: string }>(
    `SELECT is_active, COUNT(*) as count FROM editorial_posts GROUP BY is_active`
  );

  const typeRows = await query<{ post_type: EditorialPostType; count: string }>(
    `SELECT post_type, COUNT(*) as count FROM editorial_posts WHERE is_active = true GROUP BY post_type`
  );

  let active = 0;
  let archived = 0;

  for (const row of countRows) {
    if (row.is_active) {
      active = parseInt(row.count);
    } else {
      archived = parseInt(row.count);
    }
  }

  const byType: Record<EditorialPostType, number> = {
    breaking: 0,
    context: 0,
    event: 0,
    pinned: 0,
  };

  for (const row of typeRows) {
    byType[row.post_type] = parseInt(row.count);
  }

  return {
    total: active + archived,
    active,
    archived,
    byType,
  };
}
