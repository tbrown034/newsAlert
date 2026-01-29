// Editorial Posts API - GET (list), POST (create)

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  getActiveEditorialPosts,
  getAllEditorialPosts,
  createEditorialPost,
  getEditorialStats,
} from '@/lib/editorial';
import { EditorialPostCreate } from '@/types/editorial';
import { WatchpointId } from '@/types';

// Allowed admin emails (same as auth.ts)
const ALLOWED_EMAILS = [
  'tbrown034@gmail.com',
  'trevorbrown.web@gmail.com',
];

// Check if user is authenticated admin
async function getAdminSession(): Promise<{ email: string } | null> {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user?.email) {
      return null;
    }

    if (!ALLOWED_EMAILS.includes(session.user.email.toLowerCase())) {
      return null;
    }

    return { email: session.user.email };
  } catch {
    return null;
  }
}

/**
 * GET /api/editorial
 * List editorial posts
 *
 * Query params:
 * - region: Filter by region (optional)
 * - admin: If "true", include archived posts (requires auth)
 * - stats: If "true", return stats instead of posts
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') as WatchpointId | null;
  const adminMode = searchParams.get('admin') === 'true';
  const statsMode = searchParams.get('stats') === 'true';

  // Admin endpoints require authentication
  if (adminMode || statsMode) {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (statsMode) {
      const stats = await getEditorialStats();
      return NextResponse.json(stats);
    }

    const posts = await getAllEditorialPosts(true); // Include archived
    return NextResponse.json({ posts });
  }

  // Public endpoint - get active posts
  try {
    const posts = await getActiveEditorialPosts(region ?? undefined);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[Editorial API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch editorial posts', posts: [] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/editorial
 * Create a new editorial post (requires admin auth)
 */
export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!body.postType || !['breaking', 'context', 'event', 'pinned'].includes(body.postType)) {
      return NextResponse.json(
        { error: 'Valid postType is required (breaking, context, event, pinned)' },
        { status: 400 }
      );
    }

    const data: EditorialPostCreate = {
      title: body.title.trim(),
      content: body.content?.trim() || undefined,
      url: body.url?.trim() || undefined,
      postType: body.postType,
      region: body.region || null,
      pinOrder: typeof body.pinOrder === 'number' ? body.pinOrder : 0,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      mediaUrl: body.mediaUrl?.trim() || undefined,
      internalNote: body.internalNote?.trim() || undefined,
    };

    const post = await createEditorialPost(data, admin.email);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('[Editorial API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create editorial post' },
      { status: 500 }
    );
  }
}
