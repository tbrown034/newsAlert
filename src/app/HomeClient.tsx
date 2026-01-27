'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsFeed, Legend, WorldMap, SeismicMap, WeatherMap, OutagesMap, TravelMap, FiresMap, AuthButton } from '@/components';
import { watchpoints as defaultWatchpoints } from '@/lib/mockData';
import { NewsItem, WatchpointId, Watchpoint, Earthquake } from '@/types';
import { GlobeAltIcon, CloudIcon, SignalIcon, ExclamationTriangleIcon, FireIcon, EllipsisHorizontalIcon, Bars3Icon, XMarkIcon, ChevronUpIcon, ChevronDownIcon, SunIcon, MoonIcon, InformationCircleIcon, BoltIcon } from '@heroicons/react/24/outline';
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
}

type HeroView = 'main' | 'hotspots' | 'seismic' | 'weather' | 'outages' | 'travel' | 'fires';

interface HomeClientProps {
  initialData: ApiResponse | null;
  initialRegion: WatchpointId;
}

export default function HomeClient({ initialData, initialRegion }: HomeClientProps) {
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

  // Track if T2 fetch is in progress
  const isT2FetchingRef = useRef(false);
  const [isLoadingT2, setIsLoadingT2] = useState(false);

  // Fetch T2 sources async and merge with existing items
  const fetchT2Async = useCallback(async (region: WatchpointId) => {
    if (isT2FetchingRef.current) return;
    isT2FetchingRef.current = true;
    setIsLoadingT2(true);

    try {
      const response = await fetch(`/api/news?region=${region}&tier=T2&hours=6&limit=200`);
      if (!response.ok) return;

      const data: ApiResponse = await response.json();
      const t2Items = data.items.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));

      if (t2Items.length > 0) {
        // Merge T2 items with existing items (avoiding duplicates)
        setNewsItems((prev) => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = t2Items.filter(item => !existingIds.has(item.id));

          if (newItems.length === 0) return prev;

          // Merge and sort by timestamp
          const merged = [...prev, ...newItems].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );
          return merged;
        });
      }
    } catch {
      // T2 fetch is non-critical, fail silently
    } finally {
      isT2FetchingRef.current = false;
      setIsLoadingT2(false);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    setIsRefreshing(true);
    setNewsError(null);
    const startTime = Date.now();

    try {
      // First fetch T1 sources (critical, fast)
      const response = await fetch(`/api/news?region=${selectedWatchpoint}&tier=T1&hours=6&limit=100`, {
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

      // After T1 loads, async fetch T2 sources (will animate in)
      fetchT2Async(selectedWatchpoint);

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
  }, [selectedWatchpoint, fetchT2Async]);

  // Fetch when region changes (but not on initial mount if we have data)
  useEffect(() => {
    if (hasInitialData.current && selectedWatchpoint === initialRegion) {
      hasInitialData.current = false;
      // We have T1 data from SSR, now async fetch T2
      fetchT2Async(selectedWatchpoint);
      return;
    }
    fetchNews();
  }, [selectedWatchpoint, fetchNews, fetchT2Async, initialRegion]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchNews(), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

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

  useEffect(() => {
    if (heroView === 'seismic' && earthquakes.length === 0) {
      fetchEarthquakes();
    }
  }, [heroView, earthquakes.length, fetchEarthquakes]);

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
    { id: 'hotspots', label: 'Hotspots', icon: BoltIcon, color: 'orange' },
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
              aria-label="Pulse Alert home - reset to all regions"
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
                  Pulse Alert
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
                      onClick={() => setHeroView(tab.id as HeroView)}
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
                      onClick={() => setHeroView(tab.id)}
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
                              setHeroView(tab.id);
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
            {heroView === 'hotspots' && (
              <WorldMap
                watchpoints={watchpoints}
                selected={selectedWatchpoint}
                onSelect={setSelectedWatchpoint}
                regionCounts={regionCounts}
                activity={activityData || undefined}
                significantQuakes={significantQuakes}
                hoursWindow={hoursWindow}
                hotspotsOnly
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
                    .sort((a, b) => b[1].multiplier - a[1].multiplier) // Sort by multiplier desc
                : [];

              if (elevatedRegions.length === 0) {
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">All Normal</span>
                  </div>
                );
              }

              // Show max 2 indicators to avoid crowding on mobile
              const visibleRegions = elevatedRegions.slice(0, 2);
              const hiddenCount = elevatedRegions.length - 2;

              return (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {visibleRegions.map(([regionId, data]) => {
                    const isCritical = data.level === 'critical';
                    const color = isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400';
                    const dotColor = isCritical ? 'bg-red-500' : 'bg-orange-500';
                    return (
                      <div key={regionId} className="flex items-center gap-1.5 group relative">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                        <span className={`text-xs ${color}`}>
                          {isCritical ? 'Surge in' : 'More'} posts about <span className="font-medium">{regionNames[regionId] || regionId}</span>{isCritical ? '' : ' than usual'}
                        </span>
                      </div>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">+{hiddenCount} more</span>
                  )}
                </div>
              );
            })()}
            {significantQuakes.length > 0 && (
              <button
                onClick={() => setHeroView('seismic')}
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
                      onClick={() => setHeroView(tab.id as HeroView)}
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
          </div>
        )}
      </section>

      {/* Main Content */}
      <main id="feed" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 pb-20 pt-4 sm:pt-6">
        <div className="mb-4 sm:mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse-soft bg-emerald-500" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Live Wire
            </h2>
          </div>
          <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-500">
            {totalSources} sources
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
          <NewsFeed
            items={newsItems}
            selectedWatchpoint={selectedWatchpoint}
            onSelectWatchpoint={setSelectedWatchpoint}
            isLoading={isRefreshing}
            isLoadingMore={isLoadingT2}
            onRefresh={fetchNews}
            activity={activityData || undefined}
            lastUpdated={lastFetched}
            error={newsError}
            onRetry={fetchNews}
            loadTimeMs={newsLoadTimeMs}
          />
        </div>
      </main>

      <Legend />
    </div>
  );
}
