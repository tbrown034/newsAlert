'use client';

import { memo, useState, useEffect } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { ArrowPathIcon, PlusIcon, MinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Watchpoint, WatchpointId } from '@/types';

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
}

// Activity level colors - visual language:
// Green = Normal (baseline), Orange = Elevated, Red = Critical, Blue = Low (below normal), Gray = No data
const activityColors: Record<string, { fill: string; glow: string; text: string }> = {
  critical: { fill: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', text: 'text-red-400' },      // Red - critical
  high: { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.5)', text: 'text-orange-400' },      // Orange - high
  elevated: { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', text: 'text-orange-400' },  // Orange - elevated
  normal: { fill: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)', text: 'text-green-400' },      // Green - normal
  low: { fill: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', text: 'text-blue-400' },         // Blue - below normal
  no_data: { fill: '#6b7280', glow: 'rgba(107, 114, 128, 0.2)', text: 'text-gray-400' },    // Gray - no data
};

// Region marker positions (longitude, latitude) with representative cities
const regionMarkers: Record<string, { coordinates: [number, number]; label: string; city: string }> = {
  'middle-east': { coordinates: [51.4, 32.4], label: 'Middle East', city: 'Tehran' },
  'ukraine': { coordinates: [37.6, 50.4], label: 'Ukraine', city: 'Kyiv' },
  'china-taiwan': { coordinates: [121.5, 25.0], label: 'Taiwan', city: 'Taipei' },
  'latam': { coordinates: [-58.4, -10.0], label: 'Latin America', city: 'São Paulo' },
  'us-domestic': { coordinates: [-98.5, 39.8], label: 'United States', city: 'DC' },
};

// Default zoom settings
const DEFAULT_CENTER: [number, number] = [40, 25];
const DEFAULT_ZOOM = 1;

function WorldMapComponent({ watchpoints, selected, onSelect, regionCounts = {} }: WorldMapProps) {
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

  const getActivityLevel = (id: string) => {
    const wp = watchpoints.find(w => w.id === id);
    return wp?.activityLevel || 'normal';
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
            const colors = activityColors[activityLevel];
            const isSelected = selected === id;
            const isHovered = hoveredMarker === id;
            const isHot = activityLevel === 'critical' || activityLevel === 'high';
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

                {/* Pulse ring for hot regions */}
                {isHot && (
                  <circle
                    r={28}
                    fill="none"
                    stroke={colors.fill}
                    strokeWidth={3}
                    opacity={0.5}
                    className="animate-ping"
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
                  className={isHot ? 'animate-pulse' : ''}
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
            className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Zoom in"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Zoom out"
          >
            <MinusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Reset map view"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>

        {/* "All Regions" button */}
        <button
          onClick={() => onSelect('all')}
          className={`
            absolute bottom-4 left-4 px-4 py-2 rounded-full text-sm font-medium
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
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
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
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-500" />
            <span>No Data</span>
          </div>
        </div>
      </div>

      {/* Selected Region Info Bar */}
      {selected !== 'all' && (
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/90 backdrop-blur-sm border-t border-slate-700/50 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <span
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: activityColors[getActivityLevel(selected)].fill }}
            />
            <span className="text-sm sm:text-base font-semibold text-white truncate">
              {regionMarkers[selected]?.label || selected}
            </span>
            <span className={`text-xs sm:text-sm font-medium ${activityColors[getActivityLevel(selected)].text} hidden xs:inline`}>
              {getActivityLevel(selected).charAt(0).toUpperCase() + getActivityLevel(selected).slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-xs sm:text-sm text-gray-300">
              {regionCounts[selected] || 0} updates
            </span>
            <button
              onClick={() => onSelect('all')}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Clear region selection"
              title="Clear selection"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const WorldMap = memo(WorldMapComponent);
