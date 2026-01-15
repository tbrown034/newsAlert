'use client';

import { memo, useState, useEffect } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
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

// Activity level colors
const activityColors: Record<string, { fill: string; glow: string; text: string }> = {
  critical: { fill: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', text: 'text-red-400' },
  high: { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.5)', text: 'text-orange-400' },
  elevated: { fill: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-400' },
  normal: { fill: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', text: 'text-blue-400' },
  low: { fill: '#10b981', glow: 'rgba(16, 185, 129, 0.3)', text: 'text-emerald-400' },
};

// Region marker positions (longitude, latitude) with representative cities
const regionMarkers: Record<string, { coordinates: [number, number]; label: string; city: string }> = {
  'middle-east': { coordinates: [51.4, 32.4], label: 'Middle East', city: 'Tehran' },
  'ukraine-russia': { coordinates: [37.6, 50.4], label: 'Ukraine', city: 'Kyiv' },
  'china-taiwan': { coordinates: [121.5, 25.0], label: 'Taiwan', city: 'Taipei' },
  'venezuela': { coordinates: [-66.9, 10.5], label: 'Venezuela', city: 'Caracas' },
  'us-domestic': { coordinates: [-98.5, 39.8], label: 'United States', city: 'DC' },
};

function WorldMapComponent({ watchpoints, selected, onSelect, regionCounts = {} }: WorldMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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
            center: [40, 25],
          }}
          style={{
            width: '100%',
            height: '100%',
          }}
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
            const isHot = activityLevel === 'critical' || activityLevel === 'high';
            const count = regionCounts[id] || 0;

            return (
              <Marker
                key={id}
                coordinates={marker.coordinates}
                onClick={() => onSelect(id as WatchpointId)}
                style={{ default: { cursor: 'pointer' } }}
              >
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

                {/* Outer glow */}
                <circle
                  r={isSelected ? 20 : 16}
                  fill={colors.glow}
                  opacity={0.6}
                />

                {/* Main marker */}
                <circle
                  r={isSelected ? 12 : 10}
                  fill={colors.fill}
                  stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 3 : 1}
                  className={isHot ? 'animate-pulse' : ''}
                />

                {/* Count badge */}
                {count > 0 && (
                  <>
                    <circle
                      cx={16}
                      cy={-16}
                      r={12}
                      fill="#0a0d12"
                      stroke={colors.fill}
                      strokeWidth={2}
                    />
                    <text
                      x={16}
                      y={-12}
                      textAnchor="middle"
                      fill={colors.fill}
                      fontSize={11}
                      fontWeight="bold"
                    >
                      {count > 99 ? '99+' : count}
                    </text>
                  </>
                )}

                {/* Label */}
                <text
                  y={30}
                  textAnchor="middle"
                  fill={isSelected ? '#fff' : '#d1d5db'}
                  fontSize={14}
                  fontWeight={isSelected ? 'bold' : '500'}
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                    pointerEvents: 'none',
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
              </Marker>
            );
          })}
        </ComposableMap>

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
        <div className="absolute bottom-4 right-4 flex items-center gap-4 text-xs text-gray-400 z-10 bg-black/60 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Normal</span>
          </div>
        </div>
      </div>

      {/* Selected Region Info Bar */}
      {selected !== 'all' && (
        <div className="px-4 py-3 bg-black/40 border-t border-gray-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: activityColors[getActivityLevel(selected)].fill }}
            />
            <span className="text-base font-medium text-gray-100">
              {regionMarkers[selected]?.label || selected}
            </span>
            <span className={`text-sm ${activityColors[getActivityLevel(selected)].text}`}>
              {getActivityLevel(selected).charAt(0).toUpperCase() + getActivityLevel(selected).slice(1)} Activity
            </span>
          </div>
          <span className="text-sm text-gray-400">
            {regionCounts[selected] || 0} in last hour
          </span>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const WorldMap = memo(WorldMapComponent);
