'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsFeed, Legend, WorldMap, SeismicMap, WeatherMap, OutagesMap, TravelMap, FiresMap, AuthButton } from '@/components';
import { EditorialFAB } from '@/components/EditorialFAB';
import { ErrorBoundary, FeedSkeleton, MapSkeleton } from '@/components/ErrorBoundary';
import { watchpoints as defaultWatchpoints } from '@/lib/mockData';
import { NewsItem, WatchpointId, Watchpoint, Earthquake } from '@/types';
import { useClock } from '@/hooks/useClock';
import { GlobeAltIcon, CloudIcon, SignalIcon, ExclamationTriangleIcon, FireIcon, EllipsisHorizontalIcon, Bars3Icon, XMarkIcon, ChevronDownIcon, SunIcon, MoonIcon, InformationCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useSession } from '@/lib/auth-client';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { RegionActivity } from '@/lib/activityDetection';
import { tier1Sources, tier2Sources, tier3Sources } from '@/lib/sources-clean';

interface ApiResponse {
  items: NewsItem[];
  activity: Record<string, RegionActivity>;
  fetchedAt: string;
  totalItems: number;
  tiers?: string[];
  hoursWindow?: number;
  sourcesCount?: number;
  isIncremental?: boolean;
}

type HeroView = 'main' | 'seismic' | 'weather' | 'outages' | 'travel' | 'fires';

interface HomeClientProps {
  initialData: ApiResponse | null;
  initialRegion: WatchpointId;
  initialMapFocus?: WatchpointId; // Focus map here without filtering feed
}

export default function HomeClient({ initialData, initialRegion, initialMapFocus }: HomeClientProps) {
  const { data: session } = useSession();
  const [selectedWatchpoint, setSelectedWatchpointState] = useState<WatchpointId>(initialRegion);

  // Wrapper to persist region selection to localStorage
  const setSelectedWatchpoint = useCallback((region: WatchpointId) => {
    setSelectedWatchpointState(region);
    localStorage.setItem('news-selected-region', region);
  }, []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => {
    if (!initialData?.items) return [];
    return initialData.items.map(item => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  });
  const [watchpoints, setWatchpoints] = useState<Watchpoint[]>(() => {
    if (!initialData?.activity) return defaultWatchpoints;
    return defaultWatchpoints.map(wp => {
      const activity = initialData.activity[wp.id];
      if (activity) {
        return { ...wp, activityLevel: activity.level as Watchpoint['activityLevel'] };
      }
      return wp;
    });
  });
  const [lastFetched, setLastFetched] = useState<string | null>(initialData?.fetchedAt || null);
  const [activityData, setActivityData] = useState<ApiResponse['activity'] | null>(initialData?.activity || null);
  const [activityConfirmed, setActivityConfirmed] = useState(false); // True after client-side fetch confirms fresh data
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsLoadTimeMs, setNewsLoadTimeMs] = useState<number | null>(null);
  const [hoursWindow, setHoursWindow] = useState<number>(initialData?.hoursWindow || 6);

  // Live update settings
  const [pendingItems, setPendingItems] = useState<NewsItem[]>([]); // Buffer for new items
  const [autoUpdate, setAutoUpdate] = useState<boolean>(true); // Default to true, load from localStorage in useEffect
  const [displayLimit, setDisplayLimit] = useState<number>(50); // Pagination: how many to show

  // Hero view mode
  const [heroView, setHeroView] = useState<HeroView>('main');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [significantQuakes, setSignificantQuakes] = useState<Earthquake[]>([]); // 6.0+ for Main view
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null);
  const [seismicLoading, setSeismicLoading] = useState(false);
  const [seismicLastFetched, setSeismicLastFetched] = useState<Date | null>(null);
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [useUTC, setUseUTC] = useState(false);
  const currentTime = useClock();

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Format time for header display
  const formatHeaderTime = () => {
    // Return placeholder during SSR/hydration to avoid mismatch
    if (!currentTime) return '—';

    if (useUTC) {
      return currentTime.toLocaleString('en-US', {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' UTC';
    }
    return currentTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
  };

  // Initialize autoUpdate preference from localStorage (after hydration)
  useEffect(() => {
    const saved = localStorage.getItem('news-auto-update');
    if (saved !== null) {
      setAutoUpdate(saved === 'true');
    }
  }, []);

  // Restore saved region preference for returning users
  useEffect(() => {
    const savedRegion = localStorage.getItem('news-selected-region') as WatchpointId | null;
    if (savedRegion && ['all', 'us', 'latam', 'middle-east', 'europe-russia', 'asia'].includes(savedRegion)) {
      setSelectedWatchpointState(savedRegion); // Use state setter directly to avoid re-saving
    }
  }, []);

  // Toggle theme and persist to localStorage
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Ref for dropdown click-outside handling
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic source count
  const totalSources = tier1Sources.length + tier2Sources.length + tier3Sources.length;

  // Ref to prevent duplicate fetches
  const isFetchingRef = useRef(false);
  const hasInitialData = useRef(!!initialData);

  // Toggle auto-update preference (saves to localStorage in handler, not useEffect)
  const toggleAutoUpdate = useCallback(() => {
    setAutoUpdate(prev => {
      const newValue = !prev;
      localStorage.setItem('news-auto-update', String(newValue));
      return newValue;
    });
  }, []);

  // Show pending items (user clicked the "X new posts" banner)
  const showPendingItems = useCallback(() => {
    if (pendingItems.length === 0) return;

    setNewsItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const unique = pendingItems.filter(i => !existingIds.has(i.id));

      if (unique.length === 0) return prev;

      // Sort new items by timestamp (newest first among new items)
      const sortedNew = unique.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      // PREPEND only - never insert in middle of existing feed
      return [...sortedNew, ...prev];
    });

    setPendingItems([]);
  }, [pendingItems]);

  // Fetch incremental updates (only items newer than lastFetched)
  // Uses prepend-only logic - new items always appear at top, never mid-feed
  const fetchIncremental = useCallback(async () => {
    if (!lastFetched || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // Always fetch ALL regions for incremental - filtering is client-side
      const since = encodeURIComponent(lastFetched);
      const response = await fetch(
        `/api/news?region=all&hours=6&limit=100&since=${since}`
      );

      if (!response.ok) return;

      const data: ApiResponse = await response.json();

      if (data.items.length > 0) {
        const newItems = data.items.map((item) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));

        // Use functional updates to avoid depending on newsItems/pendingItems state
        if (autoUpdate) {
          // Auto-update ON: Prepend new items directly to feed
          setNewsItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
            if (uniqueNewItems.length === 0) return prev;
            const sortedNew = uniqueNewItems.sort(
              (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
            );
            return [...sortedNew, ...prev];
          });
        } else {
          // Auto-update OFF: Add to pending buffer
          setPendingItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
            if (uniqueNewItems.length === 0) return prev;
            return [...prev, ...uniqueNewItems];
          });
        }
      }

      // Update lastFetched for next incremental fetch
      setLastFetched(data.fetchedAt);

      // Update activity data if provided
      if (data.activity) {
        setActivityData(data.activity);
        setActivityConfirmed(true); // Mark as confirmed from client fetch
        setWatchpoints((prev) =>
          prev.map((wp) => {
            const activity = data.activity[wp.id];
            if (activity) {
              return { ...wp, activityLevel: activity.level as Watchpoint['activityLevel'] };
            }
            return wp;
          })
        );
      }
    } catch {
      // Incremental fetch is non-critical, fail silently
    } finally {
      isFetchingRef.current = false;
    }
  }, [lastFetched, autoUpdate]); // Removed selectedWatchpoint - always fetches 'all'

  const fetchNews = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    setIsRefreshing(true);
    setNewsError(null);
    const startTime = Date.now();

    try {
      // Always fetch ALL regions - client-side filtering handles display
      // This prevents refetching when switching tabs
      const response = await fetch(`/api/news?region=all&hours=6&limit=2000`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      const elapsed = Date.now() - startTime;
      setNewsLoadTimeMs(elapsed);

      const items = data.items.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));

      setNewsItems(items);
      setLastFetched(data.fetchedAt);
      setDisplayLimit(50); // Reset pagination on fresh fetch
      if (data.hoursWindow) setHoursWindow(data.hoursWindow);

      if (data.activity) {
        setActivityData(data.activity);
        setActivityConfirmed(true); // Mark as confirmed from client fetch
        setWatchpoints((prev) =>
          prev.map((wp) => {
            const activity = data.activity[wp.id];
            if (activity) {
              return { ...wp, activityLevel: activity.level as Watchpoint['activityLevel'] };
            }
            return wp;
          })
        );
      }

    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        setNewsError('Request timed out. Try again in a moment.');
      } else {
        setNewsError(error instanceof Error ? error.message : 'Failed to load news feed');
      }
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []); // No dependencies - always fetches 'all'

  // Store latest callbacks in refs to avoid useEffect dependency issues
  const fetchNewsRef = useRef(fetchNews);
  const fetchIncrementalRef = useRef(fetchIncremental);
  useEffect(() => { fetchNewsRef.current = fetchNews; }, [fetchNews]);
  useEffect(() => { fetchIncrementalRef.current = fetchIncremental; }, [fetchIncremental]);

  // Initial data fetch (once on mount)
  // Region changes are handled client-side via filtering - no refetch needed
  useEffect(() => {
    if (hasInitialData.current) {
      hasInitialData.current = false;
      // We have SSR data - fetch any items newer than fetchedAt (fills the gap)
      fetchIncrementalRef.current();
    } else {
      // No SSR data (failed or timed out) - do a full fetch
      fetchNewsRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 5 minutes using incremental updates
  useEffect(() => {
    const interval = setInterval(() => fetchIncrementalRef.current(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchEarthquakes = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    setSeismicLoading(true);

    try {
      const response = await fetch('/api/seismic?period=day&minMag=4.5', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (data.earthquakes) {
        setEarthquakes(data.earthquakes.map((eq: any) => ({
          ...eq,
          time: new Date(eq.time),
        })));
        setSeismicLastFetched(new Date());
      }
    } catch {
      clearTimeout(timeoutId);
    } finally {
      setSeismicLoading(false);
    }
  }, []);

  // Handler for changing hero view - fetches data when needed (not in useEffect)
  const handleHeroViewChange = useCallback((view: HeroView) => {
    setHeroView(view);
    // Fetch earthquake data when seismic tab is opened (if not already loaded)
    if (view === 'seismic' && earthquakes.length === 0) {
      fetchEarthquakes();
    }
  }, [earthquakes.length, fetchEarthquakes]);

  // Fetch significant earthquakes (6.0+) for Main view on mount
  useEffect(() => {
    const fetchSignificantQuakes = async () => {
      try {
        const response = await fetch('/api/seismic?period=day&minMag=6');
        if (!response.ok) return;
        const data = await response.json();
        if (data.earthquakes) {
          setSignificantQuakes(data.earthquakes.map((eq: any) => ({
            ...eq,
            time: new Date(eq.time),
          })));
        }
      } catch {
        // Silent fail for Main view - earthquakes are supplementary
      }
    };
    fetchSignificantQuakes();
  }, []);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!moreDropdownRef.current?.contains(target)) {
        setShowMoreTabs(false);
      }
    };
    if (showMoreTabs) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreTabs]);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const regionCounts = newsItems.reduce((acc, item) => {
    acc[item.region] = (acc[item.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mainTabs = [
    { id: 'main', label: 'Main', icon: GlobeAltIcon, color: 'blue' },
    { id: 'seismic', label: 'Seismic', icon: MapPinIcon, color: 'amber' },
  ] as const;

  const secondaryTabs = [
    { id: 'weather', label: 'Weather', icon: CloudIcon, color: 'cyan' },
    { id: 'outages', label: 'Outages', icon: SignalIcon, color: 'purple' },
    { id: 'travel', label: 'Travel', icon: ExclamationTriangleIcon, color: 'rose' },
    { id: 'fires', label: 'Fires', icon: FireIcon, color: 'orange' },
  ] as const;

  const allTabs = [...mainTabs, ...secondaryTabs];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button
              onClick={() => {
                setSelectedWatchpoint('all');
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 sm:gap-4 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg"
              aria-label="News Pulse home - reset to all regions"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-xl flex items-center justify-center shadow-md shadow-black/30 border border-slate-700">
                <svg viewBox="0 0 32 32" className="w-6 h-6 sm:w-7 sm:h-7">
                  {/* Bold P */}
                  <text x="8" y="22" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="700" fill="#ffffff">P</text>
                  {/* Pulse line */}
                  <path d="M4 26 L10 26 L12 23 L14 29 L16 24 L18 26 L28 26" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-left">
                <h1 className="text-xl sm:text-2xl font-bold headline text-slate-900 dark:text-white">
                  News Pulse
                </h1>
                <p className="text-2xs sm:text-xs font-medium tracking-wide uppercase hidden xs:block text-cyan-600 dark:text-cyan-400">
                  News Before Its News
                </p>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              <a
                href="#map"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
              >
                Map
              </a>
              <a
                href="#feed"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
              >
                Feed
              </a>
              <a
                href="/about"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
              >
                About
              </a>
              {session && (
                <a
                  href="/admin"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
                >
                  Admin
                </a>
              )}
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
              <AuthButton />
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>

{/* Mobile Menu - Slide-out Panel */}
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />

              {/* Panel */}
              <div className="fixed top-0 right-0 bottom-0 w-72 bg-white dark:bg-slate-900 z-50 md:hidden shadow-2xl transform transition-transform duration-300 ease-out">
                {/* Panel Header */}
                <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Menu</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 -mr-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Close menu"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Panel Content */}
                <div className="flex flex-col h-[calc(100%-3.5rem)] overflow-y-auto">
                  {/* Navigation Section */}
                  <div className="p-2">
                    <p className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Navigation
                    </p>
                    <a
                      href="#map"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <MapPinIcon className="w-5 h-5 text-slate-400" />
                      Map View
                    </a>
                    <a
                      href="#feed"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <GlobeAltIcon className="w-5 h-5 text-slate-400" />
                      Live Feed
                    </a>
                    <a
                      href="/about"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <InformationCircleIcon className="w-5 h-5 text-slate-400" />
                      About
                    </a>
                    {session && (
                      <a
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      >
                        <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
                        Admin
                      </a>
                    )}
                  </div>

                  {/* Preferences Section */}
                  <div className="p-2 border-t border-slate-200 dark:border-slate-800">
                    <p className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Preferences
                    </p>
                    <button
                      onClick={toggleTheme}
                      className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {theme === 'dark' ? (
                          <SunIcon className="w-5 h-5 text-slate-400" />
                        ) : (
                          <MoonIcon className="w-5 h-5 text-slate-400" />
                        )}
                        <span>Appearance</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        {theme === 'dark' ? 'Dark' : 'Light'}
                      </span>
                    </button>
                  </div>

                  {/* Account Section - Push to bottom */}
                  <div className="mt-auto p-2 border-t border-slate-200 dark:border-slate-800">
                    <p className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Account
                    </p>
                    <AuthButton variant="mobile" onNavigate={() => setMobileMenuOpen(false)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Hero Map Section */}
      <section id="map" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 pt-4">
          <div className="relative bg-slate-100 dark:bg-slate-900 rounded-t-2xl border border-slate-300 dark:border-slate-600 border-b-0 shadow-lg shadow-black/5 dark:shadow-black/30">
            {/* Map Header with integrated tabs - outside overflow-hidden so dropdowns work */}
            <div className="relative z-10 px-3 sm:px-4 py-2 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 rounded-t-2xl">
              <div className="flex items-center justify-between gap-2">
                {/* Dynamic Title */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {heroView === 'main' && (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <GlobeAltIcon className="w-4 h-4 text-blue-500" />
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Global Monitor</h2>
                      </div>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-6">{formatHeaderTime()}</span>
                    </div>
                  )}
                  {heroView === 'seismic' && (
                    <>
                      <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Seismic Activity</h2>
                    </>
                  )}
                  {heroView === 'weather' && (
                    <>
                      <CloudIcon className="w-4 h-4 text-sky-500" />
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Weather Alerts</h2>
                    </>
                  )}
                  {heroView === 'outages' && (
                    <>
                      <SignalIcon className="w-4 h-4 text-purple-500" />
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Internet Outages</h2>
                    </>
                  )}
                  {heroView === 'travel' && (
                    <>
                      <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Travel Advisories</h2>
                    </>
                  )}
                  {heroView === 'fires' && (
                    <>
                      <FireIcon className="w-4 h-4 text-orange-500" />
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Wildfire Tracker</h2>
                    </>
                  )}
                </div>

                {/* Tabs - right side: Main + Seismic visible, rest in More dropdown */}
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1">
                    {mainTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleHeroViewChange(tab.id)}
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                          ${heroView === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }
                        `}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                    {/* More dropdown for secondary tabs */}
                    <div className="relative" ref={moreDropdownRef}>
                      <button
                        onClick={() => setShowMoreTabs(!showMoreTabs)}
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                          ${secondaryTabs.some(t => t.id === heroView)
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }
                        `}
                      >
                        <EllipsisHorizontalIcon className="w-3.5 h-3.5 sm:hidden" />
                        <span className="hidden sm:inline">More</span>
                        <ChevronDownIcon className={`hidden sm:block w-3 h-3 transition-transform ${showMoreTabs ? 'rotate-180' : ''}`} />
                      </button>
                      {showMoreTabs && (
                        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-50">
                          {secondaryTabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => {
                                handleHeroViewChange(tab.id);
                                setShowMoreTabs(false);
                              }}
                              className={`
                                w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors
                                ${heroView === tab.id
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }
                              `}
                            >
                              <tab.icon className="w-4 h-4" />
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Map content area - overflow-hidden to clip maps while allowing header dropdowns */}
            <div className="overflow-hidden">
              <ErrorBoundary section="Map" fallback={<MapSkeleton />}>
              {heroView === 'main' && (
                <WorldMap
                  watchpoints={watchpoints}
                  selected={selectedWatchpoint}
                  onSelect={setSelectedWatchpoint}
                  regionCounts={regionCounts}
                  activity={activityData || undefined}
                  significantQuakes={significantQuakes}
                  hoursWindow={hoursWindow}
                  useUTC={useUTC}
                  initialFocus={initialMapFocus}
                />
              )}
              {heroView === 'seismic' && (
                <SeismicMap
                  earthquakes={earthquakes}
                  selected={selectedQuake}
                  onSelect={setSelectedQuake}
                  isLoading={seismicLoading}
                  lastFetched={seismicLastFetched}
                  onRefresh={fetchEarthquakes}
                />
              )}
              {heroView === 'weather' && <WeatherMap />}
              {heroView === 'outages' && <OutagesMap />}
              {heroView === 'travel' && <TravelMap />}
              {heroView === 'fires' && <FiresMap />}
              </ErrorBoundary>
            </div>
          </div>

        {/* Status Bar - flush against map bottom */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-b-2xl border-x border-b border-slate-300 dark:border-slate-600 -mt-[1px] text-xs text-slate-500 dark:text-slate-400 shadow-lg shadow-black/5 dark:shadow-black/30">
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">

            {/* Seismic Legend */}
            {heroView === 'seismic' && (
              <div className="flex items-center gap-3">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Magnitude:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>7+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>6+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>5+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span>4+</span>
                </div>
              </div>
            )}

            {/* Weather Legend */}
            {heroView === 'weather' && (
              <div className="flex items-center gap-3">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Severity:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Extreme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Severe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Moderate</span>
                </div>
              </div>
            )}

            {/* Fires Legend */}
            {heroView === 'fires' && (
              <div className="flex items-center gap-3">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Severity:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Critical</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>Severe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Moderate</span>
                </div>
              </div>
            )}

            {/* Outages Legend */}
            {heroView === 'outages' && (
              <div className="flex items-center gap-3">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Severity:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Critical</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Severe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Moderate</span>
                </div>
              </div>
            )}

            {/* Travel Legend */}
            {heroView === 'travel' && (
              <div className="flex items-center gap-3">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Advisory:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Do Not Travel</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Reconsider</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Caution</span>
                </div>
              </div>
            )}

            {/* Main View - Activity Indicators */}
            {heroView === 'main' && (() => {
              const regionNames: Record<string, string> = {
                'us': 'US',
                'middle-east': 'MidEast',
                'europe-russia': 'Europe',
                'asia': 'Asia',
                'latam': 'LatAm',
              };

              // Show loading state until activity is confirmed from client fetch
              // This prevents stale cached data from showing false elevated/critical
              if (!activityConfirmed) {
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      Checking feed activity...
                    </span>
                  </div>
                );
              }

              // Get all regions with elevated or critical activity
              const elevatedRegions = activityData
                ? Object.entries(activityData)
                    .filter(([, data]) => data.level === 'elevated' || data.level === 'critical')
                    .sort((a, b) => (b[1].multiplier || 0) - (a[1].multiplier || 0)) // Sort by multiplier desc
                : [];

              const hasElevated = elevatedRegions.length > 0;
              const hasCritical = elevatedRegions.some(([, data]) => data.level === 'critical');

              return (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
                  {/* Always show global status */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      hasCritical ? 'bg-red-500 animate-pulse' : hasElevated ? 'bg-orange-500' : 'bg-green-500'
                    }`} />
                    <span className={`font-medium ${
                      hasCritical
                        ? 'text-red-600 dark:text-red-400'
                        : hasElevated
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      Feed activity {hasCritical ? 'surging' : hasElevated ? 'elevated' : 'normal'}
                    </span>
                    {!hasElevated && (
                      <span className="text-slate-500 dark:text-slate-500 text-xs">(globally)</span>
                    )}
                  </div>

                  {/* Show elevated regions - clickable to filter */}
                  {elevatedRegions.slice(0, 3).map(([regionId, data]) => {
                    const isCritical = data.level === 'critical';
                    const color = isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400';
                    const hoverColor = isCritical ? 'hover:text-red-500 dark:hover:text-red-300' : 'hover:text-orange-500 dark:hover:text-orange-300';
                    const dotColor = isCritical ? 'bg-red-500' : 'bg-orange-500';
                    const pctText = data.percentChange ? `+${data.percentChange}%` : '';
                    return (
                      <button
                        key={regionId}
                        onClick={() => setSelectedWatchpoint(regionId as WatchpointId)}
                        className={`flex items-center gap-1 ${hoverColor} transition-colors`}
                        title={`Filter to ${regionNames[regionId] || regionId}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isCritical ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs ${color} font-medium`}>
                          {regionNames[regionId] || regionId} {isCritical ? 'surge' : pctText}
                        </span>
                      </button>
                    );
                  })}
                  {elevatedRegions.length > 3 && (
                    <span className="text-2xs text-slate-500 dark:text-slate-400">+{elevatedRegions.length - 3}</span>
                  )}
                </div>
              );
            })()}
            {heroView === 'main' && significantQuakes.length > 0 && (
              <button
                onClick={() => handleHeroViewChange('seismic')}
                className="flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-700 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span className="text-slate-700 dark:text-slate-300 hover:text-yellow-600 dark:hover:text-yellow-400">{significantQuakes.length} large earthquake{significantQuakes.length > 1 ? 's' : ''}</span>
              </button>
            )}
          </div>
          {/* More toggle button */}
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-1 px-2 py-1 text-2xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            aria-expanded={showStats}
          >
            More
            <ChevronDownIcon className={`w-3 h-3 transition-transform ${showStats ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Collapsible more panel */}
        {showStats && (
          <div className="mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            {/* Quick links to views */}
            <div>
              <div className="text-2xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium">Views</div>
              <div className="flex flex-wrap gap-2">
                {allTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = heroView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleHeroViewChange(tab.id as HeroView)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors ${
                        isActive
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Stats */}
            <div>
              <div className="text-2xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium">Stats</div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500">Window:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{hoursWindow}h</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500">Latency:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{newsLoadTimeMs ? `${(newsLoadTimeMs / 1000).toFixed(1)}s` : '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500">Sources:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{totalSources}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500">Map Time:</span>
                  <button
                    onClick={() => setUseUTC(!useUTC)}
                    className="font-mono text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted underline-offset-2 transition-colors"
                  >
                    {useUTC ? 'UTC' : 'Local'}
                  </button>
                </div>
              </div>
            </div>
            {/* Map Key - view-specific */}
            <div>
              <div className="text-2xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium">Map Key</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                {/* Activity levels - Main view */}
                {heroView === 'main' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 dark:text-slate-500 text-2xs">({hoursWindow}h)</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span>Typical</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span>2x+</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>4x+</span>
                      </span>
                    </div>
                    {significantQuakes.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="text-slate-400 dark:text-slate-500 text-2xs">(24h)</span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span>M6+</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          <span>M6.5+</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>M7+</span>
                        </span>
                      </div>
                    )}
                  </>
                )}
                {/* Seismic magnitude scale */}
                {heroView === 'seismic' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span>M2.5+</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>M4.5+</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>M6+</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>M7+</span>
                    </span>
                  </div>
                )}
                {/* Weather severity */}
                {heroView === 'weather' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      <span>Advisory</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Watch</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>Warning</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Emergency</span>
                    </span>
                  </div>
                )}
                {/* Outages severity */}
                {heroView === 'outages' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Minor</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>Significant</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Major</span>
                    </span>
                  </div>
                )}
                {/* Travel advisory levels */}
                {heroView === 'travel' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Level 1</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Level 2</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>Level 3</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Level 4</span>
                    </span>
                  </div>
                )}
                {/* Fire intensity */}
                {heroView === 'fires' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Low</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>Moderate</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>High</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Content */}
      <main id="feed" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 pb-20 pt-4">
        <ErrorBoundary section="News Feed" fallback={<FeedSkeleton count={5} />}>
        <div className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 shadow-lg shadow-black/5 dark:shadow-black/30">
          <NewsFeed
            items={newsItems.slice(0, displayLimit)}
            selectedWatchpoint={selectedWatchpoint}
            onSelectWatchpoint={setSelectedWatchpoint}
            isLoading={isRefreshing}
            onRefresh={fetchNews}
            activity={activityData || undefined}
            lastUpdated={lastFetched}
            error={newsError}
            onRetry={fetchNews}
            loadTimeMs={newsLoadTimeMs}
            pendingCount={pendingItems.length}
            onShowPending={showPendingItems}
            autoUpdate={autoUpdate}
            onToggleAutoUpdate={toggleAutoUpdate}
            totalPosts={newsItems.length}
            uniqueSources={new Set(newsItems.map(i => i.source.id)).size}
            hoursWindow={hoursWindow}
            allItemsForTrending={newsItems}
          />

          {/* Load more button - shows when there are more items beyond displayLimit */}
          {newsItems.length > displayLimit && (
            <div className="px-4 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                onClick={() => setDisplayLimit(prev => prev + 50)}
                className="w-full py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ChevronDownIcon className="w-4 h-4" />
                Load more ({newsItems.length - displayLimit} remaining)
              </button>
            </div>
          )}
        </div>
        </ErrorBoundary>
      </main>

      <Legend />

      {/* Editorial FAB - only visible when admin is logged in */}
      {session && <EditorialFAB onPostCreated={fetchNews} />}
    </div>
  );
}
