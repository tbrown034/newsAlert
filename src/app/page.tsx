'use client';

import { useState, useEffect, useCallback } from 'react';
import { NewsFeed, Legend, WorldMap, SituationBriefing, SeismicMap, WeatherMap, OutagesMap, TravelMap, FiresMap } from '@/components';
import { watchpoints as defaultWatchpoints } from '@/lib/mockData';
import { NewsItem, WatchpointId, Watchpoint, Earthquake } from '@/types';
import { SparklesIcon, GlobeAltIcon, CloudIcon, SignalIcon, ExclamationTriangleIcon, FireIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/24/solid';

interface ApiResponse {
  items: NewsItem[];
  activity: Record<string, { level: string; count: number; breaking: number }>;
  fetchedAt: string;
  totalItems: number;
}

type HeroView = 'hotspots' | 'seismic' | 'weather' | 'outages' | 'travel' | 'fires';

export default function Home() {
  const [selectedWatchpoint, setSelectedWatchpoint] = useState<WatchpointId>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [watchpoints, setWatchpoints] = useState<Watchpoint[]>(defaultWatchpoints);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [activityData, setActivityData] = useState<ApiResponse['activity'] | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Hero view mode
  const [heroView, setHeroView] = useState<HeroView>('hotspots');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null);
  const [seismicLoading, setSeismicLoading] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(false);

  // Activity level priority for auto-selection
  const activityPriority: Record<string, number> = {
    critical: 4,
    high: 3,
    elevated: 2,
    normal: 1,
  };

  const fetchNews = useCallback(async (autoSelectHottest = false) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    setIsRefreshing(true);
    setNewsError(null);
    console.log(`[NewsFeed] Fetching news for region: ${selectedWatchpoint}`);
    const startTime = Date.now();

    try {
      const response = await fetch(`/api/news?region=${selectedWatchpoint}&limit=50`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[NewsFeed] API error ${response.status}:`, errorData);
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`[NewsFeed] Loaded ${data.items.length} items in ${elapsed}ms`);

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
              return {
                ...wp,
                activityLevel: activity.level as Watchpoint['activityLevel'],
              };
            }
            return wp;
          })
        );

        if (autoSelectHottest) {
          const regions = Object.entries(data.activity)
            .filter(([id]) => id !== 'all')
            .map(([id, activity]) => ({
              id: id as WatchpointId,
              priority: activityPriority[activity.level] || 0,
            }))
            .sort((a, b) => b.priority - a.priority);

          if (regions.length > 0 && regions[0].priority >= 2) {
            setSelectedWatchpoint(regions[0].id);
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[NewsFeed] Request timed out after 45s');
        setNewsError('Request timed out. The server may be busy - try again in a moment.');
      } else {
        console.error('[NewsFeed] Failed to fetch news:', error);
        setNewsError(error instanceof Error ? error.message : 'Failed to load news feed');
      }
    } finally {
      setIsRefreshing(false);
      setIsInitialLoad(false);
    }
  }, [selectedWatchpoint]);

  useEffect(() => {
    fetchNews(isInitialLoad);
  }, [fetchNews, isInitialLoad]);

  useEffect(() => {
    const interval = setInterval(fetchNews, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const handleRefresh = () => {
    fetchNews();
  };

  const fetchEarthquakes = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    setSeismicLoading(true);
    console.log('[Seismic] Fetching earthquake data...');

    try {
      const response = await fetch('/api/seismic?period=day&minMag=2.5', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[Seismic] API error ${response.status}`);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.earthquakes) {
        console.log(`[Seismic] Loaded ${data.earthquakes.length} earthquakes`);
        setEarthquakes(data.earthquakes.map((eq: any) => ({
          ...eq,
          time: new Date(eq.time),
        })));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[Seismic] Request timed out after 15s');
      } else {
        console.error('[Seismic] Failed to fetch earthquakes:', error);
      }
    } finally {
      setSeismicLoading(false);
    }
  }, []);

  useEffect(() => {
    if (heroView === 'seismic' && earthquakes.length === 0) {
      fetchEarthquakes();
    }
  }, [heroView, earthquakes.length, fetchEarthquakes]);

  const regionCounts = newsItems.reduce((acc, item) => {
    const region = item.region;
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Main tabs always visible, secondary in "More" dropdown on mobile
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
      <header className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur-sm border-b border-slate-200 dark:border-[#2f3336]">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Title */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
                <GlobeAltIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white headline">
                  Sentinel
                </h1>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium tracking-wide uppercase">
                  Global Intelligence
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#map" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                Map
              </a>
              <a href="#feed" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                Feed
              </a>
              <button
                onClick={() => setShowBriefing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm btn-press hover:shadow-md"
              >
                <SparklesIcon className="w-4 h-4" />
                AI Briefing
              </button>
            </nav>

            {/* Mobile AI button */}
            <button
              onClick={() => setShowBriefing(true)}
              className="md:hidden p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="AI Situation Briefing"
            >
              <SparklesIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Map Section */}
      <section id="map">
        {/* Map Views */}
        <div className="relative bg-slate-800 rounded-none sm:rounded-2xl sm:mx-4 xl:mx-8 2xl:mx-16 sm:mt-4 overflow-hidden shadow-xl">
          {/* View Mode Tabs - Inside map container */}
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

              <div className="relative">
                <button
                  onClick={() => setShowMoreTabs(!showMoreTabs)}
                  className={`
                    flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-md text-xs font-medium transition-colors
                    ${secondaryTabs.some(t => t.id === heroView)
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                    }
                  `}
                >
                  <EllipsisHorizontalIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">More</span>
                </button>

                {showMoreTabs && (
                  <div className="absolute top-full right-0 mt-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1.5 min-w-[140px] z-50">
                    {secondaryTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setHeroView(tab.id);
                          setShowMoreTabs(false);
                        }}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left transition-colors
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
          {heroView === 'hotspots' && (
            <WorldMap
              watchpoints={watchpoints}
              selected={selectedWatchpoint}
              onSelect={setSelectedWatchpoint}
              regionCounts={regionCounts}
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
      </section>

      {/* Divider */}
      <div className="divider max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto" />

      {/* Main Content */}
      <main id="feed" className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        {/* Section Header */}
        <div className="mb-4">
          <span className="section-label">Intelligence Feed</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white headline mt-1">
            Real-Time Updates
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Aggregated from 300+ verified OSINT sources worldwide
          </p>
        </div>

        {/* News Feed */}
        <div className="card">
          <NewsFeed
            items={newsItems}
            selectedWatchpoint={selectedWatchpoint}
            onSelectWatchpoint={setSelectedWatchpoint}
            isLoading={isRefreshing || isInitialLoad}
            onRefresh={handleRefresh}
            activity={activityData || undefined}
            lastUpdated={lastFetched}
            error={newsError}
            onRetry={handleRefresh}
          />
        </div>
      </main>

      {/* Legend */}
      <Legend />

      {/* AI Situation Briefing Modal */}
      {showBriefing && (
        <SituationBriefing
          region={selectedWatchpoint}
          onClose={() => setShowBriefing(false)}
        />
      )}
    </div>
  );
}
