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
const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1;

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface TravelAdvisory {
  id: string;
  country: string;
  countryCode: string;
  level: 1 | 2 | 3 | 4;
  levelText: string;
  title: string;
  description: string;
  url: string;
  updatedAt: Date;
  coordinates: [number, number];
  risks: string[];
}

interface TravelMapProps {
  onAdvisorySelect?: (advisory: TravelAdvisory | null) => void;
  focusOnId?: string;
}

// Level colors and labels
const levelStyles = {
  4: { color: '#dc2626', label: 'Do Not Travel', bg: 'bg-red-500' },
  3: { color: '#f59e0b', label: 'Reconsider Travel', bg: 'bg-amber-500' },
  2: { color: '#3b82f6', label: 'Increased Caution', bg: 'bg-blue-500' },
  1: { color: '#22c55e', label: 'Normal Precautions', bg: 'bg-green-500' },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TravelMapComponent({ onAdvisorySelect, focusOnId }: TravelMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [advisories, setAdvisories] = useState<TravelAdvisory[]>([]);
  const [selected, setSelected] = useState<TravelAdvisory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const { theme } = useMapTheme();
  const [position, setPosition] = useState({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
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

  const fetchAdvisories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/travel');
      const data = await response.json();
      if (data.advisories) {
        setAdvisories(data.advisories.map((a: any) => ({
          ...a,
          updatedAt: new Date(a.updatedAt),
        })));
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch travel advisories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchAdvisories();
  }, [fetchAdvisories]);

  const handleSelect = (advisory: TravelAdvisory | null) => {
    setSelected(advisory);
    onAdvisorySelect?.(advisory);
  };

  // Auto-focus on highest level advisory (or specific one if focusOnId provided)
  useEffect(() => {
    if (hasAutoFocused || advisories.length === 0 || isLoading) return;

    let targetAdvisory: TravelAdvisory | undefined;

    if (focusOnId) {
      targetAdvisory = advisories.find(a => a.id === focusOnId);
    } else {
      // Focus on highest level (4 = Do Not Travel, 3 = Reconsider, etc.)
      targetAdvisory = [...advisories].sort((a, b) => b.level - a.level)[0];
    }

    if (targetAdvisory) {
      setPosition({
        coordinates: [targetAdvisory.coordinates[0], targetAdvisory.coordinates[1]],
        zoom: 2.5,
      });
      setSelected(targetAdvisory);
      onAdvisorySelect?.(targetAdvisory);
      setHasAutoFocused(true);
    }
  }, [advisories, focusOnId, hasAutoFocused, isLoading, onAdvisorySelect]);

  // Reset auto-focus when focusOnId changes
  useEffect(() => {
    setHasAutoFocused(false);
  }, [focusOnId]);

  // Filter advisories based on selected level
  const filteredAdvisories = filterLevel
    ? advisories.filter(a => a.level === filterLevel)
    : advisories.filter(a => a.level >= 3); // Default: show level 3 & 4 only

  if (!isMounted) {
    return (
      <div className={`relative w-full ${theme.water} overflow-hidden`}>
        <div className={`relative ${mapDimensions.height} flex items-center justify-center`}>
          <div className="text-gray-500 dark:text-gray-600 text-sm">Loading travel advisories...</div>
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

          {/* Advisory markers */}
          {filteredAdvisories.map((advisory) => {
            const isSelected = selected?.id === advisory.id;
            const style = levelStyles[advisory.level];
            const baseRadius = advisory.level === 4 ? 12 : advisory.level === 3 ? 10 : 8;

            return (
              <Marker
                key={advisory.id}
                coordinates={advisory.coordinates}
                onClick={() => handleSelect(isSelected ? null : advisory)}
                style={{ default: { cursor: 'pointer' } }}
              >
                {/* Pulse for level 4 */}
                {advisory.level === 4 && (
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

                {/* Level number */}
                <text
                  y={4}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={baseRadius}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {advisory.level}
                </text>

                {/* Country code label */}
                <text
                  y={baseRadius + 14}
                  textAnchor="middle"
                  fill="#d1d5db"
                  fontSize={10}
                  fontWeight="500"
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                    pointerEvents: 'none',
                  }}
                >
                  {advisory.countryCode}
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
            <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Legend / Filter */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs z-10 bg-black/60 px-3 py-2 rounded-lg">
          {[4, 3, 2].map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(filterLevel === level ? null : level)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                filterLevel === level ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: levelStyles[level as 1|2|3|4].color }}
              />
              <span className="text-gray-300">L{level}</span>
            </button>
          ))}
        </div>

        {/* Stats badge */}
        <div className="absolute top-4 left-4 text-sm text-gray-300 z-10 bg-black/60 px-3 py-2 rounded-lg font-medium">
          {stats?.level4 || 0} Do Not Travel • {stats?.level3 || 0} Reconsider
        </div>
      </div>

      {/* Selected advisory details */}
      {selected && (
        <div className={`px-4 py-4 ${theme.infoPanelBg} border-t ${theme.infoPanelBorder}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="px-3 py-1 text-sm font-bold rounded-lg"
                  style={{
                    backgroundColor: `${levelStyles[selected.level].color}25`,
                    color: levelStyles[selected.level].color,
                  }}
                >
                  LEVEL {selected.level}
                </span>
                <span className={`text-sm ${theme.infoPanelTextMuted}`}>{formatDate(selected.updatedAt)}</span>
              </div>
              <p className={`text-base font-medium ${theme.infoPanelTextPrimary}`}>{selected.country}</p>
              <p className={`text-sm ${theme.infoPanelTextSecondary} mt-1`}>{levelStyles[selected.level].label}</p>
              {selected.risks.length > 0 && (
                <p className={`text-xs ${theme.infoPanelTextMuted} mt-2`}>
                  Risks: {selected.risks.slice(0, 4).join(', ')}
                </p>
              )}
            </div>
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rose-400 hover:text-rose-300 whitespace-nowrap font-medium"
            >
              Full Advisory →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export const TravelMap = memo(TravelMapComponent);
