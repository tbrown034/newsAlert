'use client';

import { memo, useState, useEffect } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { ArrowPathIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import type { Earthquake } from '@/types';
import { useMapTheme, mapDimensions } from '@/lib/mapTheme';

// Default zoom settings
const DEFAULT_CENTER: [number, number] = [0, 15];
const DEFAULT_ZOOM = 1;

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface SeismicMapProps {
  earthquakes: Earthquake[];
  selected: Earthquake | null;
  onSelect: (eq: Earthquake | null) => void;
  isLoading?: boolean;
  focusOnId?: string; // If provided, center on this specific earthquake
  lastFetched?: Date | null;
  onRefresh?: () => void;
}

// Get circle radius based on magnitude (exponential scaling)
function getMagnitudeRadius(mag: number): number {
  // More visible scaling: mag 2.5 = 6px, mag 5 = 16px, mag 7 = 40px
  return Math.pow(2, mag - 1) * 1.5;
}

// Get color based on magnitude
function getMagnitudeColor(mag: number): string {
  if (mag >= 7) return '#dc2626'; // Red - major
  if (mag >= 6) return '#ea580c'; // Orange - strong
  if (mag >= 5) return '#f59e0b'; // Amber - moderate
  if (mag >= 4) return '#eab308'; // Yellow - light
  return '#22c55e'; // Green - minor
}

// Get alert color
function getAlertColor(alert: Earthquake['alert']): string {
  switch (alert) {
    case 'red': return '#dc2626';
    case 'orange': return '#ea580c';
    case 'yellow': return '#eab308';
    case 'green': return '#22c55e';
    default: return '#6b7280';
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type FilterMode = 'all' | 'major';

function SeismicMapComponent({ earthquakes, selected, onSelect, isLoading, focusOnId, lastFetched, onRefresh }: SeismicMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  const [filterMode, setFilterMode] = useState<FilterMode>('major'); // Default to major only
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  const { theme } = useMapTheme();

  // Auto-focus on largest earthquake (or specific one if focusOnId provided) when data loads
  useEffect(() => {
    if (hasAutoFocused || earthquakes.length === 0) return;

    let targetQuake: Earthquake | undefined;

    if (focusOnId) {
      // Focus on specific earthquake
      targetQuake = earthquakes.find(eq => eq.id === focusOnId);
    } else {
      // Focus on largest magnitude earthquake
      targetQuake = [...earthquakes].sort((a, b) => b.magnitude - a.magnitude)[0];
    }

    if (targetQuake) {
      // Center on the earthquake with appropriate zoom
      const zoom = targetQuake.magnitude >= 6 ? 1.8 : 1.5;
      setPosition({
        coordinates: [targetQuake.coordinates[0], targetQuake.coordinates[1]],
        zoom,
      });
      // Auto-select it to show the info panel
      onSelect(targetQuake);
      setHasAutoFocused(true);
    }
  }, [earthquakes, focusOnId, hasAutoFocused, onSelect]);

  // Reset auto-focus when focusOnId changes (allows re-focusing on new target)
  useEffect(() => {
    setHasAutoFocused(false);
  }, [focusOnId]);

  // Filter earthquakes based on mode
  // Filter: 'major' = M5+, 'all' = M4+ (USGS data is typically M4+ anyway)
  const filteredEarthquakes = filterMode === 'major'
    ? earthquakes.filter(eq => eq.magnitude >= 5.0)
    : earthquakes.filter(eq => eq.magnitude >= 4.0);

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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={`relative w-full ${theme.water} overflow-hidden`}>
        <div className={`relative ${mapDimensions.height} flex items-center justify-center`}>
          <div className="text-gray-500 dark:text-gray-600 text-sm">Loading seismic map...</div>
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

          {/* Earthquake markers */}
          {filteredEarthquakes.map((eq) => {
            const isSelected = selected?.id === eq.id;
            const radius = getMagnitudeRadius(eq.magnitude);
            const color = getMagnitudeColor(eq.magnitude);

            return (
              <Marker
                key={eq.id}
                coordinates={[eq.coordinates[0], eq.coordinates[1]]}
                onClick={() => onSelect(isSelected ? null : eq)}
                style={{ default: { cursor: 'pointer' } }}
              >
                {/* Outer glow for significant quakes */}
                {eq.magnitude >= 5 && (
                  <circle
                    r={radius * 1.6}
                    fill={color}
                    fillOpacity={0.25}
                    className={eq.magnitude >= 6 ? 'animate-ping' : ''}
                  />
                )}

                {/* Main marker */}
                <circle
                  r={radius}
                  fill={color}
                  fillOpacity={0.8}
                  stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.4)'}
                  strokeWidth={isSelected ? 3 : 1}
                  className="transition-all duration-200 hover:fill-opacity-100"
                />

                {/* Magnitude label for large quakes */}
                {eq.magnitude >= 5 && (
                  <text
                    y={radius + 16}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                    fontWeight="bold"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                  >
                    M{eq.magnitude.toFixed(1)}
                  </text>
                )}
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
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Stats badge with filter toggle */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="text-sm text-gray-300 bg-black/60 px-3 py-2 rounded-lg font-medium">
            {filteredEarthquakes.length} earthquakes (24h)
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
              M5+
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-2 text-xs font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-amber-500/80 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              M4+
            </button>
          </div>
          {/* Refresh with last updated time */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 px-2.5 py-2 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh earthquake data"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              {lastFetched && !isLoading && (
                <span>{formatTimeAgo(lastFetched)}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Selected earthquake details */}
      {selected && (
        <div className={`px-4 py-4 ${theme.infoPanelBg} border-t ${theme.infoPanelBorder}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="px-3 py-1 text-sm font-bold rounded-lg"
                  style={{
                    backgroundColor: `${getMagnitudeColor(selected.magnitude)}25`,
                    color: getMagnitudeColor(selected.magnitude),
                  }}
                >
                  M{selected.magnitude.toFixed(1)}
                </span>
                <span className={`text-sm ${theme.infoPanelTextMuted}`}>{formatTimeAgo(selected.time)}</span>
                {selected.tsunami && (
                  <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-lg">
                    TSUNAMI
                  </span>
                )}
                {selected.alert && (
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-lg"
                    style={{
                      backgroundColor: `${getAlertColor(selected.alert)}20`,
                      color: getAlertColor(selected.alert),
                    }}
                  >
                    {selected.alert.toUpperCase()} ALERT
                  </span>
                )}
              </div>
              <p className={`text-base ${theme.infoPanelTextPrimary} truncate`}>{selected.place}</p>
              <p className={`text-sm ${theme.infoPanelTextSecondary} mt-1`}>
                Depth: {selected.depth.toFixed(1)}km
                {selected.felt && ` • ${selected.felt} felt reports`}
              </p>
            </div>
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 whitespace-nowrap font-medium"
            >
              USGS Details →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export const SeismicMap = memo(SeismicMapComponent);
