// Editorial Post API - GET (single), PUT (update), DELETE (archive/delete)

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  getEditorialPostById,
  updateEditorialPost,
  archiveEditorialPost,
  restoreEditorialPost,
  deleteEditorialPost,
} from '@/lib/editorial';
import { EditorialPostUpdate } from '@/types/editorial';

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/editorial/[id]
 * Get a single editorial post
 */
export async function GET(
  request: Request,
  { params }: RouteParams
) {
  const { id } = await params;

  try {
    const post = await getEditorialPostById(id);

    if (!post) {
      return NextResponse.json(
        { error: 'Editorial post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Editorial API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch editorial post' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/editorial/[id]
 * Update an editorial post (requires admin auth)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();

    // Build update data
    const data: EditorialPostUpdate = {};

    if (body.title !== undefined) {
      data.title = body.title.trim();
    }
    if (body.content !== undefined) {
      data.content = body.content?.trim() || null;
    }
    if (body.url !== undefined) {
      data.url = body.url?.trim() || null;
    }
    if (body.postType !== undefined) {
      if (!['breaking', 'context', 'event', 'pinned'].includes(body.postType)) {
        return NextResponse.json(
          { error: 'Invalid postType' },
          { status: 400 }
        );
      }
      data.postType = body.postType;
    }
    if (body.region !== undefined) {
      data.region = body.region || null;
    }
    if (body.pinOrder !== undefined) {
      data.pinOrder = body.pinOrder;
    }
    if (body.startsAt !== undefined) {
      data.startsAt = body.startsAt ? new Date(body.startsAt) : undefined;
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    }
    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }
    if (body.mediaUrl !== undefined) {
      data.mediaUrl = body.mediaUrl?.trim() || null;
    }
    if (body.internalNote !== undefined) {
      data.internalNote = body.internalNote?.trim() || null;
    }

    const post = await updateEditorialPost(id, data);

    if (!post) {
      return NextResponse.json(
        { error: 'Editorial post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Editorial API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update editorial post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/editorial/[id]
 * Archive or permanently delete an editorial post
 *
 * Query params:
 * - permanent: If "true", permanently delete. Otherwise, archive (soft delete).
 * - restore: If "true", restore an archived post.
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';
  const restore = searchParams.get('restore') === 'true';

  try {
    // Check if post exists
    const existing = await getEditorialPostById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Editorial post not found' },
        { status: 404 }
      );
    }

    if (restore) {
      await restoreEditorialPost(id);
      return NextResponse.json({ success: true, action: 'restored' });
    }

    if (permanent) {
      await deleteEditorialPost(id);
      return NextResponse.json({ success: true, action: 'deleted' });
    }

    // Default: archive (soft delete)
    await archiveEditorialPost(id);
    return NextResponse.json({ success: true, action: 'archived' });
  } catch (error) {
    console.error('[Editorial API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete editorial post' },
      { status: 500 }
    );
  }
}
