'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsFeed, Legend, WorldMap, SeismicMap, WeatherMap, OutagesMap, TravelMap, FiresMap, AuthButton } from '@/components';
import { watchpoints as defaultWatchpoints } from '@/lib/mockData';
import { NewsItem, WatchpointId, Watchpoint, Earthquake } from '@/types';
import { GlobeAltIcon, CloudIcon, SignalIcon, ExclamationTriangleIcon, FireIcon, EllipsisHorizontalIcon, Bars3Icon, XMarkIcon, ChevronUpIcon, ChevronDownIcon, SunIcon, MoonIcon, InformationCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
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
}

export default function HomeClient({ initialData, initialRegion }: HomeClientProps) {
  const { data: session } = useSession();
  const [selectedWatchpoint, setSelectedWatchpoint] = useState<WatchpointId>(initialRegion);
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
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsLoadTimeMs, setNewsLoadTimeMs] = useState<number | null>(null);
  const [hoursWindow, setHoursWindow] = useState<number>(initialData?.hoursWindow || 6);

  // Live update settings
  const [pendingItems, setPendingItems] = useState<NewsItem[]>([]); // Buffer for new items
  const [autoUpdate, setAutoUpdate] = useState<boolean>(true); // Default to true, load from localStorage in useEffect

  // Hero view mode
  const [heroView, setHeroView] = useState<HeroView>('main');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [significantQuakes, setSignificantQuakes] = useState<Earthquake[]>([]); // 6.0+ for Main view
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null);
  const [seismicLoading, setSeismicLoading] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Initialize autoUpdate preference from localStorage (after hydration)
  useEffect(() => {
    const saved = localStorage.getItem('news-auto-update');
    if (saved !== null) {
      setAutoUpdate(saved === 'true');
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

  // Refs for dropdown click-outside handling (separate for xl and smaller screens)
  const xlDropdownRef = useRef<HTMLDivElement>(null);
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
      const since = encodeURIComponent(lastFetched);
      const response = await fetch(
        `/api/news?region=${selectedWatchpoint}&hours=6&limit=100&since=${since}`
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
          // Auto-update ON: Prepend directly to feed
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
  }, [lastFetched, selectedWatchpoint, autoUpdate]);

  const fetchNews = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    setIsRefreshing(true);
    setNewsError(null);
    const startTime = Date.now();

    try {
      // Fetch all sources (no tier separation)
      const response = await fetch(`/api/news?region=${selectedWatchpoint}&hours=6&limit=200`, {
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
      if (data.hoursWindow) setHoursWindow(data.hoursWindow);

      if (data.activity) {
        setActivityData(data.activity);
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
  }, [selectedWatchpoint]);

  // Store latest callbacks in refs to avoid useEffect dependency issues
  const fetchNewsRef = useRef(fetchNews);
  const fetchIncrementalRef = useRef(fetchIncremental);
  useEffect(() => { fetchNewsRef.current = fetchNews; }, [fetchNews]);
  useEffect(() => { fetchIncrementalRef.current = fetchIncremental; }, [fetchIncremental]);

  // Fetch when region changes (but not on initial mount if we have data)
  useEffect(() => {
    if (hasInitialData.current && selectedWatchpoint === initialRegion) {
      hasInitialData.current = false;
      // We have SSR data - fetch any items newer than fetchedAt (fills the gap)
      fetchIncrementalRef.current();
      return;
    }
    // Region changed - do full refresh
    fetchNewsRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWatchpoint, initialRegion]);

  // Auto-refresh every 60 seconds using incremental updates
  useEffect(() => {
    const interval = setInterval(() => fetchIncrementalRef.current(), 60 * 1000);
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

  // Click outside handler for dropdown (check both refs)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideXl = xlDropdownRef.current?.contains(target);
      const clickedInsideMore = moreDropdownRef.current?.contains(target);
      if (!clickedInsideXl && !clickedInsideMore) {
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
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center shadow-md shadow-black/30 border border-slate-600">
                <svg viewBox="0 0 32 32" className="w-5 h-5 sm:w-6 sm:h-6">
                  <defs>
                    <linearGradient id="headerPulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22d3ee"/>
                      <stop offset="100%" stopColor="#3b82f6"/>
                    </linearGradient>
                  </defs>
                  {/* Globe outline */}
                  <circle cx="16" cy="16" r="9" fill="none" stroke="url(#headerPulseGrad)" strokeWidth="2"/>
                  {/* Globe meridian */}
                  <ellipse cx="16" cy="16" rx="3.5" ry="9" fill="none" stroke="url(#headerPulseGrad)" strokeWidth="1.5" opacity="0.7"/>
                  {/* Globe equator */}
                  <ellipse cx="16" cy="16" rx="9" ry="3.5" fill="none" stroke="url(#headerPulseGrad)" strokeWidth="1.5" opacity="0.7"/>
                  {/* Outer pulse ring */}
                  <circle cx="16" cy="16" r="14" fill="none" stroke="url(#headerPulseGrad)" strokeWidth="1.5" opacity="0.35" className="animate-pulse-subtle"/>
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
        {/* Map Layer Tabs - Above the map */}
        <div className="flex items-center mb-2">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
            {mapCollapsed ? (
              /* Show Map button when collapsed */
              <button
                onClick={() => setMapCollapsed(false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <ChevronUpIcon className="w-4 h-4" />
                <span>Show Map</span>
              </button>
            ) : (
              /* Normal tabs when expanded */
              <>
                {/* All tabs on xl screens */}
                <div className="hidden xl:flex items-center gap-1">
                  {allTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleHeroViewChange(tab.id as HeroView)}
                      aria-label={tab.label}
                      aria-pressed={heroView === tab.id}
                      className={`
                        flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors
                        ${heroView === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                  {/* Hide option on xl */}
                  <div className="relative" ref={xlDropdownRef}>
                    <button
                      onClick={() => setShowMoreTabs(!showMoreTabs)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-expanded={showMoreTabs}
                      aria-haspopup="true"
                    >
                      <EllipsisHorizontalIcon className="w-4 h-4" />
                    </button>
                    {showMoreTabs && (
                      <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-50">
                        <button
                          onClick={() => {
                            setMapCollapsed(true);
                            setShowMoreTabs(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                        >
                          <ChevronDownIcon className="w-4 h-4" />
                          Hide Map
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact tabs with More dropdown on smaller screens */}
                <div className="flex xl:hidden items-center gap-1">
                  {mainTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleHeroViewChange(tab.id)}
                      aria-label={tab.label}
                      aria-pressed={heroView === tab.id}
                      className={`
                        flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors
                        ${heroView === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="relative" ref={moreDropdownRef}>
                    <button
                      onClick={() => setShowMoreTabs(!showMoreTabs)}
                      className={`
                        flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                        ${secondaryTabs.some(t => t.id === heroView)
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                      aria-expanded={showMoreTabs}
                      aria-haspopup="true"
                      aria-label="More map layers"
                    >
                      <EllipsisHorizontalIcon className="w-4 h-4" />
                      <span>More</span>
                    </button>

                    {showMoreTabs && (
                      <div
                        className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] z-50"
                        role="menu"
                        aria-orientation="vertical"
                      >
                        {secondaryTabs.map((tab) => (
                          <button
                            key={tab.id}
                            role="menuitem"
                            onClick={() => {
                              handleHeroViewChange(tab.id);
                              setShowMoreTabs(false);
                            }}
                            className={`
                              w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left transition-colors
                              focus:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800
                              ${heroView === tab.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}
                            `}
                          >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                          </button>
                        ))}
                        {/* Hide Map option */}
                        <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMapCollapsed(true);
                              setShowMoreTabs(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800"
                          >
                            <ChevronDownIcon className="w-4 h-4" />
                            Hide Map
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Map Container - Hidden when collapsed */}
        {!mapCollapsed && (
          <div className="relative bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-black/10 dark:shadow-black/20">
            {/* Dynamic Map Header */}
            <div className="px-3 sm:px-4 py-2 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                {heroView === 'main' && (
                  <>
                    <GlobeAltIcon className="w-4 h-4 text-blue-500" />
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Global Monitor</h2>
                  </>
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
            </div>

            {heroView === 'main' && (
              <WorldMap
                watchpoints={watchpoints}
                selected={selectedWatchpoint}
                onSelect={setSelectedWatchpoint}
                regionCounts={regionCounts}
                activity={activityData || undefined}
                significantQuakes={significantQuakes}
                hoursWindow={hoursWindow}
              />
            )}
            {heroView === 'seismic' && (
              <SeismicMap
                earthquakes={earthquakes}
                selected={selectedQuake}
                onSelect={setSelectedQuake}
                isLoading={seismicLoading}
              />
            )}
            {heroView === 'weather' && <WeatherMap />}
            {heroView === 'outages' && <OutagesMap />}
            {heroView === 'travel' && <TravelMap />}
            {heroView === 'fires' && <FiresMap />}
          </div>
        )}

        {/* Compact Status Bar - Activity indicators only, stats hidden in collapsible */}
        <div className="mt-2 flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
            {/* All Elevated/Critical Regions */}
            {(() => {
              const regionNames: Record<string, string> = {
                'us': 'US',
                'middle-east': 'MidEast',
                'europe-russia': 'Europe',
                'asia': 'Asia',
                'latam': 'LatAm',
              };

              // Get all regions with elevated or critical activity
              const elevatedRegions = activityData
                ? Object.entries(activityData)
                    .filter(([, data]) => data.level === 'elevated' || data.level === 'critical')
                    .sort((a, b) => (b[1].multiplier || 0) - (a[1].multiplier || 0)) // Sort by multiplier desc
                : [];

              if (elevatedRegions.length === 0) {
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Typical activity
                    </span>
                    <span className="text-slate-500 dark:text-slate-500 text-xs">
                      · {newsItems.length} posts tracked
                    </span>
                  </div>
                );
              }

              // Show max 2 indicators to avoid crowding on mobile
              const visibleRegions = elevatedRegions.slice(0, 2);
              const hiddenCount = elevatedRegions.length - 2;

              return (
                <div className="flex items-center gap-2 sm:gap-3">
                  {visibleRegions.map(([regionId, data]) => {
                    const isCritical = data.level === 'critical';
                    const color = isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400';
                    const dotColor = isCritical ? 'bg-red-500' : 'bg-orange-500';
                    const pctText = data.percentChange ? `+${data.percentChange}%` : '';
                    return (
                      <div key={regionId} className="flex items-center gap-1 group relative">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isCritical ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs ${color} font-medium`}>
                          {regionNames[regionId] || regionId} {isCritical ? 'surge' : pctText}
                        </span>
                      </div>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <span className="text-2xs text-slate-500 dark:text-slate-400">+{hiddenCount}</span>
                  )}
                </div>
              );
            })()}
            {significantQuakes.length > 0 && (
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
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
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
              </div>
            </div>
            {/* Map Key */}
            <div>
              <div className="text-2xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium">Map Key</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Content */}
      <main id="feed" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 pb-20 pt-4 sm:pt-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
          {/* Live Wire header inside the box */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse-soft bg-emerald-500" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Live Wire
              </h2>
            </div>
          </div>
          <NewsFeed
            items={newsItems}
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
          />
        </div>
      </main>

      <Legend />
    </div>
  );
}
