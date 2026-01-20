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
import { Watchpoint, WatchpointId } from '@/types';
import { RegionActivity } from '@/lib/activityDetection';

// World map TopoJSON - using a CDN for the geography data
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/**
 * Get local time at a given longitude with city name
 */
function getLocalTime(longitude: number, city: string): string {
  const now = new Date();
  // Approximate timezone offset from longitude (15 degrees = 1 hour)
  const offsetHours = Math.round(longitude / 15);
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const localTime = new Date(utcTime + offsetHours * 3600000);

  const time = localTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${time} ${city}`;
}

interface WorldMapProps {
  watchpoints: Watchpoint[];
  selected: WatchpointId;
  onSelect: (id: WatchpointId) => void;
  regionCounts?: Record<string, number>;
  activity?: Record<string, RegionActivity>;
}

// Activity level colors - visual language:
// Green = Normal, Orange = Elevated, Red = Critical
const activityColors: Record<string, { fill: string; glow: string; text: string }> = {
  critical: { fill: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', text: 'text-red-400' },      // Red - critical
  elevated: { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', text: 'text-orange-400' },  // Orange - elevated
  normal: { fill: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)', text: 'text-green-400' },      // Green - normal
};

// Region marker positions (longitude, latitude) - actual capital city coordinates
const regionMarkers: Record<string, { coordinates: [number, number]; label: string; city: string; zoom: number }> = {
  'us': { coordinates: [-77.04, 38.91], label: 'United States', city: 'DC', zoom: 2.2 },
  'latam': { coordinates: [-46.63, -23.55], label: 'Latin America', city: 'São Paulo', zoom: 1.8 },
  'middle-east': { coordinates: [51.39, 35.69], label: 'Middle East', city: 'Tehran', zoom: 2.5 },
  'europe-russia': { coordinates: [30.52, 50.45], label: 'Europe-Russia', city: 'Kyiv', zoom: 2.2 },
  'asia': { coordinates: [116.41, 39.90], label: 'Asia', city: 'Beijing', zoom: 2 },
};

// Default zoom settings
const DEFAULT_CENTER: [number, number] = [40, 25];
const DEFAULT_ZOOM = 1;

function WorldMapComponent({ watchpoints, selected, onSelect, regionCounts = {}, activity = {} }: WorldMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [position, setPosition] = useState({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

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

  // Update time every minute for local times display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Zoom to selected region
  useEffect(() => {
    if (selected === 'all') {
      setPosition({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    } else if (regionMarkers[selected]) {
      const marker = regionMarkers[selected];
      setPosition({ coordinates: marker.coordinates, zoom: marker.zoom });
    }
  }, [selected]);

  const getActivityLevel = (id: string) => {
    const wp = watchpoints.find(w => w.id === id);
    return wp?.activityLevel || 'normal';
  };

  // Format activity comparison text
  const formatActivityText = (regionActivity: RegionActivity | undefined) => {
    if (!regionActivity) return 'Loading...';
    const { multiplier } = regionActivity;
    if (multiplier >= 1) {
      return `${multiplier.toFixed(1)}x normal`;
    }
    return `${multiplier.toFixed(1)}x normal`;
  };

  // Calculate global activity stats
  const getGlobalActivity = (): { multiplier: number; level: 'critical' | 'elevated' | 'normal'; totalCount: number } => {
    const regions = Object.values(activity);
    if (regions.length === 0) return { multiplier: 1, level: 'normal', totalCount: 0 };

    const totalCount = regions.reduce((sum, r) => sum + r.count, 0);
    const totalBaseline = regions.reduce((sum, r) => sum + r.baseline, 0);
    const multiplier = totalBaseline > 0 ? Math.round((totalCount / totalBaseline) * 10) / 10 : 1;

    let level: 'critical' | 'elevated' | 'normal';
    if (regions.some(r => r.level === 'critical')) level = 'critical';
    else if (regions.some(r => r.level === 'elevated')) level = 'elevated';
    else level = 'normal';

    return { multiplier, level, totalCount };
  };

  // Show loading placeholder during SSR to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="relative w-full bg-[#0a0d12] border-b border-gray-800/60 overflow-hidden">
        <div className="relative h-[280px] sm:h-[340px] flex items-center justify-center">
          <div className="text-gray-600 text-sm">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-[#0a0d12] border-b border-gray-800/60 overflow-hidden">
      {/* Map Container */}
      <div className="relative h-[280px] sm:h-[340px]">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{
            scale: 280,
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
                  fill="#1a1f2e"
                  stroke="#2d3748"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#252d3d' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Region Markers */}
          {Object.entries(regionMarkers).map(([id, marker]) => {
            const activityLevel = getActivityLevel(id);
            const colors = activityColors[activityLevel] || activityColors.normal;
            const isSelected = selected === id;
            const isHovered = hoveredMarker === id;
            const isCritical = activityLevel === 'critical';
            const count = regionCounts[id] || 0;

            return (
              <Marker
                key={id}
                coordinates={marker.coordinates}
                onClick={() => onSelect(id as WatchpointId)}
                onMouseEnter={() => setHoveredMarker(id)}
                onMouseLeave={() => setHoveredMarker(null)}
                style={{ default: { cursor: 'pointer' } }}
              >
                {/* Selection ring animation */}
                {isSelected && (
                  <circle
                    r={24}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={2}
                    opacity={0.3}
                    strokeDasharray="4 4"
                    className="animate-spin-slow"
                  />
                )}

                {/* Pulse ring for hot regions - very subdued */}
                {isCritical && (
                  <circle
                    r={22}
                    fill="none"
                    stroke={colors.fill}
                    strokeWidth={1.5}
                    opacity={0.25}
                    className="animate-ping-subtle"
                  />
                )}

                {/* Outer glow - grows on hover */}
                <circle
                  r={isSelected ? 20 : isHovered ? 18 : 16}
                  fill={colors.glow}
                  opacity={isHovered ? 0.8 : 0.6}
                  style={{ transition: 'r 150ms ease, opacity 150ms ease' }}
                />

                {/* Main marker - scales on hover */}
                <circle
                  r={isSelected ? 12 : isHovered ? 11 : 10}
                  fill={colors.fill}
                  stroke={isSelected ? '#fff' : isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                  className={isCritical ? 'animate-pulse-subtle' : ''}
                  style={{ transition: 'r 150ms ease, stroke-width 150ms ease' }}
                />


                {/* Label */}
                <text
                  y={30}
                  textAnchor="middle"
                  fill={isSelected || isHovered ? '#fff' : '#d1d5db'}
                  fontSize={14}
                  fontWeight={isSelected || isHovered ? 'bold' : '500'}
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                    pointerEvents: 'none',
                    transition: 'fill 150ms ease',
                  }}
                >
                  {marker.label}
                </text>

                {/* Local Time with City */}
                <text
                  y={48}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize={12}
                  fontFamily="monospace"
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                    pointerEvents: 'none',
                  }}
                >
                  {getLocalTime(marker.coordinates[0], marker.city)}
                </text>

                {/* Hover tooltip - activity level */}
                {isHovered && !isSelected && (
                  <g>
                    <rect
                      x={-40}
                      y={-45}
                      width={80}
                      height={24}
                      rx={4}
                      fill="rgba(0,0,0,0.8)"
                    />
                    <text
                      y={-28}
                      textAnchor="middle"
                      fill={colors.fill}
                      fontSize={11}
                      fontWeight="600"
                      style={{ pointerEvents: 'none' }}
                    >
                      {activityLevel.toUpperCase()}
                    </text>
                  </g>
                )}
              </Marker>
            );
          })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Zoom Controls */}
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex flex-col gap-1 z-10" role="group" aria-label="Map zoom controls">
          <button
            onClick={handleZoomIn}
            className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Zoom in"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Zoom out"
          >
            <MinusIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Reset map view"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>

        {/* "All Regions" button */}
        <button
          onClick={() => onSelect('all')}
          aria-pressed={selected === 'all'}
          className={`
            absolute bottom-4 left-4 px-4 py-2.5 rounded-full text-sm font-medium min-h-[44px]
            transition-all duration-200 z-10
            ${selected === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-800/90 text-gray-300 hover:bg-gray-700/90 hover:text-white'
            }
          `}
        >
          All Regions
        </button>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3 text-xs text-gray-200 z-10 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse-subtle" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Elevated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span>Normal</span>
          </div>
        </div>
      </div>

      {/* Activity Status Bar - Always visible */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/90 backdrop-blur-sm border-t border-slate-700/50 flex items-center justify-between">
        {selected === 'all' ? (
          // Global view
          <>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <span
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${getGlobalActivity().level === 'critical' ? 'animate-pulse-subtle' : ''}`}
                style={{ backgroundColor: (activityColors[getGlobalActivity().level] || activityColors.normal).fill }}
              />
              <span className="text-sm sm:text-base font-semibold text-white">
                Global Activity
              </span>
              <span className={`text-xs sm:text-sm font-medium ${(activityColors[getGlobalActivity().level] || activityColors.normal).text}`}>
                {getGlobalActivity().level.charAt(0).toUpperCase() + getGlobalActivity().level.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <span className="text-xs sm:text-sm font-mono text-gray-300">
                {getGlobalActivity().multiplier.toFixed(1)}x normal
              </span>
            </div>
          </>
        ) : (
          // Regional view
          <>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <span
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${getActivityLevel(selected) === 'critical' ? 'animate-pulse-subtle' : ''}`}
                style={{ backgroundColor: (activityColors[getActivityLevel(selected)] || activityColors.normal).fill }}
              />
              <span className="text-sm sm:text-base font-semibold text-white">
                {regionMarkers[selected]?.label || selected}
              </span>
              <span className={`text-xs sm:text-sm font-medium ${(activityColors[getActivityLevel(selected)] || activityColors.normal).text}`}>
                {getActivityLevel(selected).charAt(0).toUpperCase() + getActivityLevel(selected).slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <span className="text-xs sm:text-sm font-mono text-gray-300">
                {formatActivityText(activity[selected])}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const WorldMap = memo(WorldMapComponent);
