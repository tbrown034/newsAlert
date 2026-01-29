'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import { EditorialModal } from '@/components/EditorialModal';
import { EditorialPost, EditorialPostCreate, EditorialPostType } from '@/types/editorial';

// Post type icons
const typeIcons: Record<EditorialPostType, React.ElementType> = {
  breaking: ExclamationTriangleIcon,
  context: InformationCircleIcon,
  event: CalendarIcon,
  pinned: BookmarkIcon,
};

const typeColors: Record<EditorialPostType, string> = {
  breaking: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  context: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  event: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  pinned: 'text-yellow-600 dark:text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EditorialAdminPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    archived: number;
    byType: Record<EditorialPostType, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<EditorialPost | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/');
    }
  }, [session, isPending, router]);

  // Fetch posts and stats
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [postsRes, statsRes] = await Promise.all([
        fetch('/api/editorial?admin=true'),
        fetch('/api/editorial?stats=true'),
      ]);

      if (!postsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const postsData = await postsRes.json();
      const statsData = await statsRes.json();

      setPosts(postsData.posts || []);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session, fetchData]);

  const handleCreatePost = async (data: EditorialPostCreate) => {
    const response = await fetch('/api/editorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create post');
    }

    await fetchData();
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this post? It will be hidden from the feed.')) return;

    try {
      const response = await fetch(`/api/editorial/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to archive post');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const response = await fetch(`/api/editorial/${id}?restore=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to restore post');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this post? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/editorial/${id}?permanent=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const filteredPosts = posts.filter((post) =>
    showArchived ? !post.isActive : post.isActive
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Admin</span>
            </Link>
            <h1 className="text-lg font-semibold">Editorial Posts</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">New Post</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-2xl font-bold text-slate-400">{stats.archived}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Archived</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-2xl font-bold text-red-600">{stats.byType.breaking}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Breaking</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-2xl font-bold text-amber-600">{stats.byType.context}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Context</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-2xl font-bold text-blue-600">{stats.byType.event}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Events</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-2xl font-bold text-yellow-600">{stats.byType.pinned}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pinned</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              !showArchived
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active ({stats?.active || 0})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showArchived
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Archived ({stats?.archived || 0})
          </button>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="ml-auto p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Posts table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {showArchived ? 'No archived posts' : 'No active posts'}
              </p>
              {!showArchived && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create your first post
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Region
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Created
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPosts.map((post) => {
                    const Icon = typeIcons[post.postType];
                    const colorClass = typeColors[post.postType];
                    return (
                      <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${colorClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {post.postType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-xs">
                            {post.title}
                          </p>
                          {post.content && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                              {post.content}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 dark:text-slate-300 uppercase">
                            {post.region || 'Global'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(post.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {post.isActive ? (
                              <>
                                <button
                                  onClick={() => setEditingPost(post)}
                                  className="p-1.5 text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors"
                                  title="Edit"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleArchive(post.id)}
                                  className="p-1.5 text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 transition-colors"
                                  title="Archive"
                                >
                                  <ArchiveBoxIcon className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleRestore(post.id)}
                                  className="p-1.5 text-slate-400 hover:text-green-500 dark:text-slate-500 dark:hover:text-green-400 transition-colors"
                                  title="Restore"
                                >
                                  <ArrowPathIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(post.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                                  title="Delete permanently"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      <EditorialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePost}
      />

      {/* Edit Modal - TODO: implement edit functionality */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingPost(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Post</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Edit functionality coming soon. For now, archive this post and create a new one.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingPost(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleArchive(editingPost.id);
                  setEditingPost(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg"
              >
                Archive & Create New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
