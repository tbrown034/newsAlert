'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { tier1Sources, tier2Sources, tier3Sources, TieredSource } from '@/lib/sources-clean';
import { ArrowLeftIcon, MagnifyingGlassIcon, FunnelIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Combine all sources
const allSources: TieredSource[] = [...tier1Sources, ...tier2Sources, ...tier3Sources];

type SortField = 'name' | 'platform' | 'sourceType' | 'fetchTier' | 'confidence' | 'region' | 'postsPerDay';
type SortDirection = 'asc' | 'desc';

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Filter states
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Sort states
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/');
    }
  }, [session, isPending, router]);

  // Get unique values for filters
  const platforms = useMemo(() => [...new Set(allSources.map(s => s.platform))], []);
  const sourceTypes = useMemo(() => [...new Set(allSources.map(s => s.sourceType))], []);
  const tiers = ['T1', 'T2', 'T3'];
  const regions = useMemo(() => [...new Set(allSources.map(s => s.region))], []);

  // Filter and sort sources
  const filteredSources = useMemo(() => {
    let result = allSources;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.handle?.toLowerCase().includes(searchLower) ||
        s.id.toLowerCase().includes(searchLower)
      );
    }

    // Platform filter
    if (platformFilter !== 'all') {
      result = result.filter(s => s.platform === platformFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(s => s.sourceType === typeFilter);
    }

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter(s => s.fetchTier === tierFilter);
    }

    // Region filter
    if (regionFilter !== 'all') {
      result = result.filter(s => s.region === regionFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [search, platformFilter, typeFilter, tierFilter, regionFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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

  // Stats
  const blueskyCount = allSources.filter(s => s.platform === 'bluesky').length;
  const rssCount = allSources.filter(s => s.platform === 'rss').length;
  const t1Count = allSources.filter(s => s.fetchTier === 'T1').length;
  const t2Count = allSources.filter(s => s.fetchTier === 'T2').length;
  const t3Count = allSources.filter(s => s.fetchTier === 'T3').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <h1 className="text-lg font-semibold">News Pulse Admin</h1>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{allSources.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Sources</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-2xl font-bold text-blue-600">{blueskyCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bluesky</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-2xl font-bold text-orange-600">{rssCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">RSS</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-2xl font-bold text-red-600">{t1Count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tier 1</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-2xl font-bold text-amber-600">{t2Count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tier 2</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-2xl font-bold text-slate-600">{t3Count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tier 3</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative lg:col-span-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search sources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Platform */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Platforms</option>
              {platforms.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>

            {/* Source Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Types</option>
              {sourceTypes.map(t => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>

            {/* Tier */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Tiers</option>
              {tiers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Region */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>{r.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing <span className="font-medium text-slate-700 dark:text-slate-200">{filteredSources.length}</span> of {allSources.length} sources
          </p>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Name
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('platform')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Platform
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('sourceType')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Type
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('fetchTier')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Tier
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('region')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Region
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('confidence')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Confidence
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort('postsPerDay')}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Posts/Day
                      <ChevronUpDownIcon className="w-4 h-4" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSources.map((source) => (
                  <tr key={source.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{source.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{source.handle || source.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                        source.platform === 'bluesky'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                      }`}>
                        {source.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                        {source.sourceType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-md ${
                        source.fetchTier === 'T1'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : source.fetchTier === 'T2'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {source.fetchTier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 dark:text-slate-300 uppercase">
                        {source.region}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              source.confidence >= 90 ? 'bg-green-500' :
                              source.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${source.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{source.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
                        {source.postsPerDay}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSources.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-slate-500 dark:text-slate-400">No sources match your filters</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
