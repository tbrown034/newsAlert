'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsFeed, Legend, WorldMap, SituationBriefing, SeismicMap, WeatherMap, OutagesMap, TravelMap, FiresMap } from '@/components';
import { watchpoints as defaultWatchpoints } from '@/lib/mockData';
import { NewsItem, WatchpointId, Watchpoint, Earthquake } from '@/types';
import { SparklesIcon, GlobeAltIcon, CloudIcon, SignalIcon, ExclamationTriangleIcon, FireIcon, EllipsisHorizontalIcon, Bars3Icon, XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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

type HeroView = 'hotspots' | 'seismic' | 'weather' | 'outages' | 'travel' | 'fires';

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
  const [showBriefing, setShowBriefing] = useState(false);
  const [activityData, setActivityData] = useState<ApiResponse['activity'] | null>(initialData?.activity || null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsLoadTimeMs, setNewsLoadTimeMs] = useState<number | null>(null);

  // Hero view mode
  const [heroView, setHeroView] = useState<HeroView>('hotspots');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null);
  const [seismicLoading, setSeismicLoading] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mapCollapsed, setMapCollapsed] = useState(false);

  // Ref for dropdown click-outside handling
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
      const response = await fetch(`/api/news?region=${region}&tier=T2&hours=12&limit=200`);
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
      const response = await fetch(`/api/news?region=${selectedWatchpoint}&tier=T1&hours=12&limit=100`, {
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

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
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
    { id: 'hotspots', label: 'Hotspots', icon: MapPinIcon, color: 'blue' },
    { id: 'seismic', label: 'Seismic', icon: GlobeAltIcon, color: 'amber' },
    { id: 'weather', label: 'Weather', icon: CloudIcon, color: 'cyan' },
  ] as const;

  const secondaryTabs = [
    { id: 'outages', label: 'Outages', icon: SignalIcon, color: 'purple' },
    { id: 'travel', label: 'Travel', icon: ExclamationTriangleIcon, color: 'rose' },
    { id: 'fires', label: 'Fires', icon: FireIcon, color: 'orange' },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--background)] border-b border-slate-200 dark:border-[#2f3336]">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button
              onClick={() => {
                setSelectedWatchpoint('all');
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 sm:gap-4 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg"
              aria-label="Sentinel home - reset to all regions"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
                <GlobeAltIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl sm:text-2xl font-bold headline" style={{ color: 'white' }}>
                  Sentinel
                </h1>
                <p className="text-2xs sm:text-xs font-medium tracking-wide uppercase hidden xs:block" style={{ color: '#1d9bf0' }}>
                  Global Intelligence
                </p>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
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
              <button
                onClick={() => setShowBriefing(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
              >
                <SparklesIcon className="w-4 h-4" />
                Summary
              </button>
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

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <nav className="md:hidden border-t border-slate-200 dark:border-[#2f3336] py-3 space-y-1">
              <a
                href="#map"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <MapPinIcon className="w-4 h-4 inline mr-2" />
                Map View
              </a>
              <a
                href="#feed"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <GlobeAltIcon className="w-4 h-4 inline mr-2" />
                Live Feed
              </a>
              <button
                onClick={() => {
                  setShowBriefing(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <SparklesIcon className="w-4 h-4 inline mr-2" />
                AI Summary
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Map Section */}
      <section id="map" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 pt-4">
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          {/* Collapse/Expand button - positioned at bottom */}
          <button
            onClick={() => setMapCollapsed(!mapCollapsed)}
            className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors text-xs font-medium"
            aria-expanded={!mapCollapsed}
            aria-label={mapCollapsed ? 'Expand map' : 'Collapse map'}
          >
            {mapCollapsed ? (
              <>
                <ChevronUpIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Show Map</span>
              </>
            ) : (
              <>
                <ChevronDownIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Hide Map</span>
              </>
            )}
          </button>

          {!mapCollapsed && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
              <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 backdrop-blur-sm rounded-lg p-0.5 sm:p-1 border border-slate-700">
                {mainTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setHeroView(tab.id)}
                    className={`
                      flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-md text-xs font-medium transition-colors
                      ${heroView === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                      }
                    `}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}

                <div className="relative" ref={moreDropdownRef}>
                  <button
                    onClick={() => setShowMoreTabs(!showMoreTabs)}
                    className={`
                      flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-md text-xs font-medium transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                      ${secondaryTabs.some(t => t.id === heroView)
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                      }
                    `}
                    aria-expanded={showMoreTabs}
                    aria-haspopup="true"
                    aria-label="More map layers"
                  >
                    <EllipsisHorizontalIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">More</span>
                  </button>

                  {showMoreTabs && (
                    <div
                      className="absolute top-full right-0 mt-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1.5 min-w-[140px] z-50"
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
                            w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left transition-colors
                            focus:outline-none focus-visible:bg-slate-600
                            ${heroView === tab.id ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}
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
          )}

          {/* Collapsed state indicator */}
          {mapCollapsed ? (
            <div className="h-12 flex items-center justify-center">
              <span className="text-slate-400 text-sm">Map hidden</span>
            </div>
          ) : (
            <>
              {heroView === 'hotspots' && (
                <WorldMap
                  watchpoints={watchpoints}
                  selected={selectedWatchpoint}
                  onSelect={setSelectedWatchpoint}
                  regionCounts={regionCounts}
                  activity={activityData || undefined}
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
            </>
          )}
        </div>
      </section>

      {/* Main Content */}
      <main id="feed" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 pb-20 pt-4 sm:pt-6">
        <div className="mb-4 sm:mb-5 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#1d9bf0' }} />
              <span className="text-2xs sm:text-xs font-semibold uppercase tracking-wider" style={{ color: '#1d9bf0' }}>
                Live Feed
              </span>
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold headline" style={{ color: '#e7e9ea' }}>
              Intelligence Updates
            </h2>
          </div>
          <p className="text-2xs sm:text-xs" style={{ color: '#71767b' }}>
            {totalSources} verified sources
          </p>
        </div>

        <div className="card shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl overflow-hidden">
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

      {showBriefing && (
        <SituationBriefing
          region={selectedWatchpoint}
          onClose={() => setShowBriefing(false)}
        />
      )}
    </div>
  );
}
