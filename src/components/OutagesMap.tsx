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

interface CountryOutage {
  id: string;
  country: string;
  countryCode: string;
  capital: string;
  coordinates: [number, number];
  severity: 'critical' | 'severe' | 'moderate' | 'minor';
  percentDown: number;
  startTime: Date;
  description: string;
  source: string;
}

interface OutagesMapProps {
  onOutageSelect?: (outage: CountryOutage | null) => void;
  focusOnId?: string;
}

const severityStyles = {
  critical: { color: '#dc2626', label: 'CRITICAL' },
  severe: { color: '#f59e0b', label: 'SEVERE' },
  moderate: { color: '#3b82f6', label: 'MODERATE' },
  minor: { color: '#6b7280', label: 'MINOR' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Severity priority for sorting
const severityPriority: Record<string, number> = {
  critical: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
};

function OutagesMapComponent({ onOutageSelect, focusOnId }: OutagesMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [outages, setOutages] = useState<CountryOutage[]>([]);
  const [selected, setSelected] = useState<CountryOutage | null>(null);
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

  const fetchOutages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/outages');
      const data = await response.json();
      if (data.outages) {
        setOutages(data.outages.map((o: any) => ({
          ...o,
          startTime: new Date(o.startTime),
        })));
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch outages:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchOutages();
  }, [fetchOutages]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const timer = setInterval(fetchOutages, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchOutages]);

  // Auto-focus on most severe outage (or specific one if focusOnId provided)
  useEffect(() => {
    if (hasAutoFocused || outages.length === 0 || isLoading) return;

    let targetOutage: CountryOutage | undefined;

    if (focusOnId) {
      targetOutage = outages.find(o => o.id === focusOnId);
    } else {
      // Focus on most severe outage
      targetOutage = [...outages].sort((a, b) =>
        (severityPriority[b.severity] || 0) - (severityPriority[a.severity] || 0)
      )[0];
    }

    if (targetOutage) {
      setPosition({
        coordinates: [targetOutage.coordinates[0], targetOutage.coordinates[1]],
        zoom: 2.5,
      });
      setSelected(targetOutage);
      onOutageSelect?.(targetOutage);
      setHasAutoFocused(true);
    }
  }, [outages, focusOnId, hasAutoFocused, isLoading, onOutageSelect]);

  // Reset auto-focus when focusOnId changes
  useEffect(() => {
    setHasAutoFocused(false);
  }, [focusOnId]);

  const handleSelect = (outage: CountryOutage | null) => {
    setSelected(outage);
    onOutageSelect?.(outage);
  };

  if (!isMounted) {
    return (
      <div className={`relative w-full ${theme.water} overflow-hidden`}>
        <div className={`relative ${mapDimensions.height} flex items-center justify-center`}>
          <div className="text-gray-500 dark:text-gray-600 text-sm">Loading outages map...</div>
        </div>
      </div>
    );
  }

  const hasOutages = outages.length > 0;

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

          {/* Outage markers on capitals */}
          {outages.map((outage) => {
            const isSelected = selected?.id === outage.id;
            const style = severityStyles[outage.severity];
            const baseRadius = outage.severity === 'critical' ? 14 :
                              outage.severity === 'severe' ? 12 : 10;

            return (
              <Marker
                key={outage.id}
                coordinates={outage.coordinates}
                onClick={() => handleSelect(isSelected ? null : outage)}
                style={{ default: { cursor: 'pointer' } }}
              >
                {/* Pulse for critical outages */}
                {outage.severity === 'critical' && (
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

                {/* WiFi/Signal icon indicator */}
                <text
                  y={1}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={baseRadius * 0.8}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  ✕
                </text>

                {/* Country label */}
                <text
                  y={baseRadius + 16}
                  textAnchor="middle"
                  fill="#d1d5db"
                  fontSize={11}
                  fontWeight="500"
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                    pointerEvents: 'none',
                  }}
                >
                  {outage.countryCode}
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
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Stats badge */}
        <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-2 rounded-lg">
          {hasOutages ? (
            <span className="text-sm text-gray-300 font-medium">
              {outages.length} {outages.length === 1 ? 'country' : 'countries'} affected
            </span>
          ) : (
            <span className="text-sm text-emerald-400 font-medium">
              ✓ No major outages detected
            </span>
          )}
        </div>
      </div>

      {/* Selected outage details */}
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
                <span className={`text-sm ${theme.infoPanelTextMuted}`}>{formatTimeAgo(selected.startTime)}</span>
              </div>
              <p className={`text-base font-medium ${theme.infoPanelTextPrimary}`}>
                {selected.country} ({selected.capital})
              </p>
              <p className={`text-sm ${theme.infoPanelTextSecondary} mt-1`}>{selected.description}</p>
              <p className={`text-xs ${theme.infoPanelTextMuted} mt-2`}>
                ~{selected.percentDown}% connectivity loss • Source: {selected.source}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state message when no outages and not selected */}
      {!hasOutages && !isLoading && !selected && (
        <div className="px-4 py-3 bg-emerald-900/20 border-t border-emerald-800/30">
          <p className="text-sm text-emerald-400 text-center">
            Global internet connectivity is stable. No significant outages detected.
          </p>
        </div>
      )}
    </div>
  );
}

export const OutagesMap = memo(OutagesMapComponent);
