'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { ArrowPathIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import { useMapTheme, mapDimensions } from '@/lib/mapTheme';

// Default zoom settings
const DEFAULT_CENTER: [number, number] = [0, 15];
const DEFAULT_ZOOM = 1;

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WeatherEvent {
  id: string;
  type: 'hurricane' | 'typhoon' | 'storm' | 'wildfire' | 'flood' | 'tornado' | 'extreme_temp';
  name: string;
  description: string;
  severity: 'extreme' | 'severe' | 'moderate' | 'minor';
  coordinates: [number, number];
  startTime: Date;
  endTime?: Date;
  source: string;
  url?: string;
  affectedAreas?: string[];
}

interface WeatherMapProps {
  onEventSelect?: (event: WeatherEvent | null) => void;
  focusOnId?: string;
}

// Event type icons and colors
const eventStyles: Record<WeatherEvent['type'], { color: string; icon: string }> = {
  hurricane: { color: '#dc2626', icon: '🌀' },
  typhoon: { color: '#dc2626', icon: '🌀' },
  storm: { color: '#f59e0b', icon: '⛈️' },
  tornado: { color: '#7c3aed', icon: '🌪️' },
  wildfire: { color: '#ea580c', icon: '🔥' },
  flood: { color: '#3b82f6', icon: '🌊' },
  extreme_temp: { color: '#06b6d4', icon: '🌡️' },
};

const severityColors = {
  extreme: '#dc2626',
  severe: '#f59e0b',
  moderate: '#3b82f6',
  minor: '#6b7280',
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type FilterMode = 'all' | 'major';

// Check if coordinates are in North America (rough bounding box)
function isNorthAmerica(coords: [number, number]): boolean {
  const [lon, lat] = coords;
  return lon >= -170 && lon <= -50 && lat >= 15 && lat <= 72;
}

// Smart filter: only headline-worthy events (would make international/national news)
function isNewsworthy(event: WeatherEvent): boolean {
  // Hurricanes/typhoons are ALWAYS headline news
  if (event.type === 'hurricane' || event.type === 'typhoon') return true;

  // Tornadoes are headline news
  if (event.type === 'tornado') return true;

  // Only EXTREME severity for other event types
  if (event.severity === 'extreme') return true;

  // Wildfires: ONLY show non-US fires (US has routine fires year-round)
  if (event.type === 'wildfire') {
    return !isNorthAmerica(event.coordinates);
  }

  // Floods: only from GDACS (international) or extreme
  if (event.type === 'flood') {
    return event.source === 'GDACS';
  }

  // Storms: skip most - only named tropical systems make headlines
  if (event.type === 'storm') {
    const name = event.name.toLowerCase();
    return name.includes('tropical') || name.includes('cyclone');
  }

  // Skip routine weather advisories
  return false;
}

// Severity priority for sorting
const severityPriority: Record<string, number> = {
  extreme: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
};

function WeatherMapComponent({ onEventSelect, focusOnId }: WeatherMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [events, setEvents] = useState<WeatherEvent[]>([]);
  const [selected, setSelected] = useState<WeatherEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const { theme } = useMapTheme();
  const [position, setPosition] = useState({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  const [filterMode, setFilterMode] = useState<FilterMode>('major'); // Default to major only
  const [hasAutoFocused, setHasAutoFocused] = useState(false);

  // Smart filter: "major" = newsworthy events only, "all" = everything
  const filteredEvents = filterMode === 'major'
    ? events.filter(isNewsworthy)
    : events;

  const handleZoomIn = () => {
    if (position.zoom >= 4) return;
    setPosition(pos => ({ ...pos, zoom: pos.zoom * 1.5 }));
  };

  const handleZoomOut = () => {
    if (position.zoom <= 0.5) return;
    setPosition(pos => ({ ...pos, zoom: pos.zoom / 1.5 }));
  };

  const handleReset = () => {
    setPosition({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  };

  const handleMoveEnd = (position: { coordinates: [number, number]; zoom: number }) => {
    setPosition(position);
  };

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/weather');
      const data = await response.json();
      if (data.events) {
        setEvents(data.events.map((e: any) => ({
          ...e,
          startTime: new Date(e.startTime),
          endTime: e.endTime ? new Date(e.endTime) : undefined,
        })));
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch weather events:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const timer = setInterval(fetchEvents, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchEvents]);

  // Auto-focus on most severe event (or specific one if focusOnId provided)
  useEffect(() => {
    if (hasAutoFocused || events.length === 0 || isLoading) return;

    let targetEvent: WeatherEvent | undefined;

    if (focusOnId) {
      targetEvent = events.find(e => e.id === focusOnId);
    } else {
      // Focus on most severe event (hurricanes/typhoons first, then by severity)
      targetEvent = [...events].sort((a, b) => {
        // Hurricanes/typhoons always top priority
        const aIsHurricane = a.type === 'hurricane' || a.type === 'typhoon';
        const bIsHurricane = b.type === 'hurricane' || b.type === 'typhoon';
        if (aIsHurricane && !bIsHurricane) return -1;
        if (bIsHurricane && !aIsHurricane) return 1;
        // Then by severity
        return (severityPriority[b.severity] || 0) - (severityPriority[a.severity] || 0);
      })[0];
    }

    if (targetEvent) {
      setPosition({
        coordinates: [targetEvent.coordinates[0], targetEvent.coordinates[1]],
        zoom: 2.5,
      });
      setSelected(targetEvent);
      onEventSelect?.(targetEvent);
      setHasAutoFocused(true);
    }
  }, [events, focusOnId, hasAutoFocused, isLoading, onEventSelect]);

  // Reset auto-focus when focusOnId changes
  useEffect(() => {
    setHasAutoFocused(false);
  }, [focusOnId]);

  const handleSelect = (event: WeatherEvent | null) => {
    setSelected(event);
    onEventSelect?.(event);
  };

  if (!isMounted) {
    return (
      <div className={`relative w-full ${theme.water} overflow-hidden`}>
        <div className={`relative ${mapDimensions.height} flex items-center justify-center`}>
          <div className="text-gray-500 dark:text-gray-600 text-sm">Loading weather map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${theme.water} overflow-hidden`}>
      <div className={`relative ${mapDimensions.height}`}>
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{
            scale: 220,
            center: [0, 0],
          }}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            onMoveEnd={handleMoveEnd}
            minZoom={0.5}
            maxZoom={4}
          >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={theme.land}
                  stroke={theme.stroke}
                  strokeWidth={theme.strokeWidth}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: theme.landHover },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Weather event markers */}
          {filteredEvents.map((event) => {
            const isSelected = selected?.id === event.id;
            const style = eventStyles[event.type];
            const baseRadius = event.severity === 'extreme' ? 14 :
                              event.severity === 'severe' ? 12 : 10;

            return (
              <Marker
                key={event.id}
                coordinates={event.coordinates}
                onClick={() => handleSelect(isSelected ? null : event)}
                style={{ default: { cursor: 'pointer' } }}
              >
                {/* Pulse for extreme events */}
                {event.severity === 'extreme' && (
                  <circle
                    r={baseRadius * 2}
                    fill={style.color}
                    fillOpacity={0.2}
                    className="animate-ping"
                  />
                )}

                {/* Outer glow */}
                <circle
                  r={isSelected ? baseRadius * 1.5 : baseRadius * 1.2}
                  fill={style.color}
                  fillOpacity={0.3}
                />

                {/* Main marker */}
                <circle
                  r={isSelected ? baseRadius : baseRadius * 0.8}
                  fill={style.color}
                  fillOpacity={0.9}
                  stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 3 : 1}
                />

              </Marker>
            );
          })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Zoom Controls */}
        <div className="absolute top-14 left-4 flex flex-col gap-1 z-10">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Zoom in"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Zoom out"
          >
            <MinusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Reset view"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Stats badge with filter toggle */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="text-sm text-gray-300 bg-black/60 px-3 py-2 rounded-lg font-medium">
            {filteredEvents.length} active alerts
          </div>
          <div className="flex bg-black/60 rounded-lg overflow-hidden">
            <button
              onClick={() => setFilterMode('major')}
              className={`px-2.5 py-2 text-xs font-medium transition-colors ${
                filterMode === 'major'
                  ? 'bg-amber-500/80 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Major
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-2 text-xs font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-amber-500/80 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Selected event details */}
      {selected && (
        <div className={`px-4 py-4 ${theme.infoPanelBg} border-t ${theme.infoPanelBorder}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: eventStyles[selected.type].color }}
                />
                <span
                  className="px-3 py-1 text-sm font-bold rounded-lg"
                  style={{
                    backgroundColor: `${severityColors[selected.severity]}25`,
                    color: severityColors[selected.severity],
                  }}
                >
                  {selected.severity.toUpperCase()}
                </span>
                <span className={`text-sm ${theme.infoPanelTextMuted}`}>{formatTimeAgo(selected.startTime)}</span>
              </div>
              <p className={`text-base font-medium ${theme.infoPanelTextPrimary}`}>{selected.name}</p>
              <p className={`text-sm ${theme.infoPanelTextSecondary} mt-1 line-clamp-2`}>{selected.description}</p>
              {selected.affectedAreas && selected.affectedAreas.length > 0 && (
                <p className={`text-xs ${theme.infoPanelTextMuted} mt-2`}>
                  Areas: {selected.affectedAreas.slice(0, 3).join(', ')}
                  {selected.affectedAreas.length > 3 && ` +${selected.affectedAreas.length - 3} more`}
                </p>
              )}
            </div>
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-400 hover:text-amber-300 whitespace-nowrap font-medium"
              >
                Details →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const WeatherMap = memo(WeatherMapComponent);
