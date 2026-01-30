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
import { FireIcon } from '@heroicons/react/24/solid';
import { useMapTheme, mapDimensions } from '@/lib/mapTheme';

// Default zoom settings
const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1;

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface FireEvent {
  id: string;
  title: string;
  description: string;
  coordinates: [number, number];
  date: Date;
  source: 'EONET' | 'GDACS' | 'FIRMS';
  severity: 'critical' | 'severe' | 'moderate' | 'minor';
  url: string;
  category?: string;
  area?: string;
}

interface FiresMapProps {
  onFireSelect?: (fire: FireEvent | null) => void;
  focusOnId?: string; // If provided, center on this specific fire
}

const severityStyles = {
  critical: { color: '#dc2626', label: 'CRITICAL' },
  severe: { color: '#f97316', label: 'SEVERE' },
  moderate: { color: '#eab308', label: 'MODERATE' },
  minor: { color: '#84cc16', label: 'MINOR' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Severity priority for sorting (critical > severe > moderate > minor)
const severityPriority: Record<string, number> = {
  critical: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
};

function FiresMapComponent({ onFireSelect, focusOnId }: FiresMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [fires, setFires] = useState<FireEvent[]>([]);
  const [selected, setSelected] = useState<FireEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const { theme } = useMapTheme();
  const [position, setPosition] = useState({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  const [hasAutoFocused, setHasAutoFocused] = useState(false);

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

  const fetchFires = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fires');
      const data = await response.json();
      if (data.fires) {
        setFires(data.fires.map((f: any) => ({
          ...f,
          date: new Date(f.date),
        })));
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch fires:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchFires();
  }, [fetchFires]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const timer = setInterval(fetchFires, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchFires]);

  // Auto-focus on most severe fire (or specific one if focusOnId provided)
  useEffect(() => {
    if (hasAutoFocused || fires.length === 0 || isLoading) return;

    let targetFire: FireEvent | undefined;

    if (focusOnId) {
      targetFire = fires.find(f => f.id === focusOnId);
    } else {
      // Focus on most severe fire
      targetFire = [...fires].sort((a, b) =>
        (severityPriority[b.severity] || 0) - (severityPriority[a.severity] || 0)
      )[0];
    }

    if (targetFire) {
      setPosition({
        coordinates: [targetFire.coordinates[0], targetFire.coordinates[1]],
        zoom: 2.5,
      });
      setSelected(targetFire);
      onFireSelect?.(targetFire);
      setHasAutoFocused(true);
    }
  }, [fires, focusOnId, hasAutoFocused, isLoading, onFireSelect]);

  // Reset auto-focus when focusOnId changes
  useEffect(() => {
    setHasAutoFocused(false);
  }, [focusOnId]);

  const handleSelect = (fire: FireEvent | null) => {
    setSelected(fire);
    onFireSelect?.(fire);
  };

  if (!isMounted) {
    return (
      <div className={`relative w-full ${theme.water} overflow-hidden`}>
        <div className={`relative ${mapDimensions.height} flex items-center justify-center`}>
          <div className="text-gray-500 dark:text-gray-600 text-sm">Loading fire data...</div>
        </div>
      </div>
    );
  }

  const hasFires = fires.length > 0;

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

          {/* Fire markers */}
          {fires.map((fire) => {
            const isSelected = selected?.id === fire.id;
            const style = severityStyles[fire.severity];
            const baseRadius = fire.severity === 'critical' ? 14 :
                              fire.severity === 'severe' ? 12 : 10;

            return (
              <Marker
                key={fire.id}
                coordinates={fire.coordinates}
                onClick={() => handleSelect(isSelected ? null : fire)}
                style={{ default: { cursor: 'pointer' } }}
              >
                {/* Animated pulse for critical fires */}
                {fire.severity === 'critical' && (
                  <circle
                    r={baseRadius * 2}
                    fill={style.color}
                    fillOpacity={0.3}
                    className="animate-ping"
                  />
                )}

                {/* Outer glow */}
                <circle
                  r={isSelected ? baseRadius * 1.5 : baseRadius * 1.2}
                  fill={style.color}
                  fillOpacity={0.4}
                />

                {/* Main marker */}
                <circle
                  r={isSelected ? baseRadius : baseRadius * 0.8}
                  fill={style.color}
                  fillOpacity={0.9}
                  stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 3 : 1}
                />

                {/* Fire icon indicator */}
                <text
                  y={3}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={baseRadius * 0.7}
                  style={{ pointerEvents: 'none' }}
                >
                  🔥
                </text>
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
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Stats badge */}
        <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-2 rounded-lg flex items-center gap-2">
          <FireIcon className="w-4 h-4 text-orange-500" />
          {hasFires ? (
            <span className="text-sm text-gray-300 font-medium">
              {fires.length} active {fires.length === 1 ? 'fire' : 'fires'}
            </span>
          ) : (
            <span className="text-sm text-emerald-400 font-medium">
              No major fires detected
            </span>
          )}
        </div>
      </div>

      {/* Selected fire details */}
      {selected && (
        <div className={`px-4 py-4 ${theme.infoPanelBg} border-t ${theme.infoPanelBorder}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="px-3 py-1 text-sm font-bold rounded-lg"
                  style={{
                    backgroundColor: `${severityStyles[selected.severity].color}25`,
                    color: severityStyles[selected.severity].color,
                  }}
                >
                  {severityStyles[selected.severity].label}
                </span>
                <span className={`text-sm ${theme.infoPanelTextMuted}`}>{formatTimeAgo(selected.date)}</span>
                <span className={`text-xs ${theme.infoPanelTextMuted} bg-slate-700 px-2 py-0.5 rounded`}>
                  {selected.source}
                </span>
              </div>
              <p className={`text-base font-medium ${theme.infoPanelTextPrimary}`}>{selected.title}</p>
              {selected.area && (
                <p className={`text-sm ${theme.infoPanelTextSecondary} mt-1`}>{selected.area}</p>
              )}
              <p className={`text-xs ${theme.infoPanelTextMuted} mt-2 line-clamp-2`}>{selected.description}</p>
            </div>
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-400 hover:text-orange-300 whitespace-nowrap font-medium"
            >
              Details →
            </a>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasFires && !isLoading && !selected && (
        <div className="px-4 py-3 bg-emerald-900/20 border-t border-emerald-800/30">
          <p className="text-sm text-emerald-400 text-center">
            No significant wildfire activity detected globally.
          </p>
        </div>
      )}
    </div>
  );
}

export const FiresMap = memo(FiresMapComponent);
