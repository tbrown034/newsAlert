'use client';

import { useState, useEffect, useCallback } from 'react';
import { WatchpointSelector, NewsFeed, Legend, WorldMap, SituationBriefing, SeismicMap, WeatherMap, OutagesMap, TravelMap, FiresMap } from '@/components';
import { watchpoints as defaultWatchpoints } from '@/lib/mockData';
import { NewsItem, WatchpointId, Watchpoint, Earthquake } from '@/types';
import { SparklesIcon, GlobeAltIcon, CloudIcon, SignalIcon, ExclamationTriangleIcon, FireIcon } from '@heroicons/react/24/outline';
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

  // Hero view mode
  const [heroView, setHeroView] = useState<HeroView>('hotspots');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null);
  const [seismicLoading, setSeismicLoading] = useState(false);

  // Activity level priority for auto-selection
  const activityPriority: Record<string, number> = {
    critical: 4,
    high: 3,
    elevated: 2,
    normal: 1,
  };

  const fetchNews = useCallback(async (autoSelectHottest = false) => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/news?region=${selectedWatchpoint}&limit=50`);
      const data: ApiResponse = await response.json();

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
      console.error('Failed to fetch news:', error);
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
    setSeismicLoading(true);
    try {
      const response = await fetch('/api/seismic?period=day&minMag=2.5');
      const data = await response.json();
      if (data.earthquakes) {
        setEarthquakes(data.earthquakes.map((eq: any) => ({
          ...eq,
          time: new Date(eq.time),
        })));
      }
    } catch (error) {
      console.error('Failed to fetch earthquakes:', error);
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

  const viewTabs = [
    { id: 'hotspots', label: 'Hotspots', icon: MapPinIcon, color: 'blue' },
    { id: 'seismic', label: 'Seismic', icon: GlobeAltIcon, color: 'amber' },
    { id: 'weather', label: 'Weather', icon: CloudIcon, color: 'cyan' },
    { id: 'outages', label: 'Outages', icon: SignalIcon, color: 'purple' },
    { id: 'travel', label: 'Travel', icon: ExclamationTriangleIcon, color: 'rose' },
    { id: 'fires', label: 'Fires', icon: FireIcon, color: 'orange' },
  ] as const;

  const getTabClasses = (tabId: string, color: string) => {
    const isActive = heroView === tabId;
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-600 text-white',
      amber: 'bg-amber-500 text-white',
      cyan: 'bg-cyan-500 text-white',
      purple: 'bg-purple-600 text-white',
      rose: 'bg-rose-500 text-white',
      orange: 'bg-orange-500 text-white',
    };
    return isActive
      ? colorMap[color]
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Title */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
                <GlobeAltIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-serif tracking-tight">
                  Sentinel
                </h1>
                <p className="text-xs text-blue-600 font-medium tracking-wide uppercase">
                  Global Intelligence
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#map" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Map
              </a>
              <a href="#feed" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Feed
              </a>
              <button
                onClick={() => setShowBriefing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
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
      <section id="map" className="relative">
        {/* Section Label */}
        <div className="absolute top-4 left-4 z-10">
          <span className="section-label">Live Monitoring</span>
        </div>

        {/* View Mode Tabs */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-20">
          <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-xl p-1.5 shadow-lg border border-slate-200 max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-hide">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHeroView(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-shrink-0
                  ${getTabClasses(tab.id, tab.color)}
                `}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Views */}
        <div className="bg-slate-800 rounded-none sm:rounded-2xl sm:mx-4 sm:mt-4 overflow-hidden shadow-xl">
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
      <div className="divider max-w-6xl mx-auto" />

      {/* Main Content */}
      <main id="feed" className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        {/* Section Header */}
        <div className="mb-6">
          <span className="section-label">Intelligence Feed</span>
          <h2 className="text-3xl font-bold text-slate-900 font-serif mt-2">
            Real-Time Updates
          </h2>
          <p className="text-slate-600 mt-1">
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
