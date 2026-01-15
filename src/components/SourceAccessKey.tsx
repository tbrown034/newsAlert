'use client';

import { useState } from 'react';
import { SourceProvenance, ProvenanceType } from '@/types';

interface SourceAccessKeyProps {
  provenance: SourceProvenance;
  compact?: boolean;
}

// Provenance types ordered from closest to event to furthest
const provenanceOrder: ProvenanceType[] = [
  'on-ground',
  'direct',
  'analysis',
  'aggregated',
  'reported',
];

// Configuration for each provenance type
const provenanceConfig: Record<ProvenanceType, {
  icon: string;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  details: string[];
}> = {
  'on-ground': {
    icon: '📍',
    label: 'On Ground',
    shortLabel: 'Ground',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    description: 'First-hand witness at the scene',
    details: [
      'Eyewitness account',
      'Video/photo from location',
      'Real-time ground reporting',
    ],
  },
  'direct': {
    icon: '🎙',
    label: 'Direct',
    shortLabel: 'Direct',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Official statement or primary document',
    details: [
      'Government/military statement',
      'Press release',
      'Primary documents',
    ],
  },
  'analysis': {
    icon: '🔍',
    label: 'Analysis',
    shortLabel: 'Analysis',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'OSINT analysis of imagery or data',
    details: [
      'Satellite imagery analysis',
      'Flight/ship tracking data',
      'Document verification',
    ],
  },
  'aggregated': {
    icon: '📡',
    label: 'Aggregated',
    shortLabel: 'Aggregated',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Curating and compiling multiple reports',
    details: [
      'Multiple source compilation',
      'Cross-referencing reports',
      'Breaking news aggregation',
    ],
  },
  'reported': {
    icon: '📰',
    label: 'Reported',
    shortLabel: 'Reported',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    description: 'News organization citing sources',
    details: [
      'Anonymous sources cited',
      'Officials speaking on background',
      'Wire service reporting',
    ],
  },
};

// Spectrum colors for the gradient bar
const spectrumColors = {
  'on-ground': '#ef4444',
  'direct': '#10b981',
  'analysis': '#3b82f6',
  'aggregated': '#f59e0b',
  'reported': '#6b7280',
};

export function SourceAccessKey({ provenance, compact = false }: SourceAccessKeyProps) {
  const [hoveredType, setHoveredType] = useState<ProvenanceType | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const currentIndex = provenanceOrder.indexOf(provenance.type);
  const currentConfig = provenanceConfig[provenance.type];

  // Calculate position on spectrum (0-100%)
  const spectrumPosition = (currentIndex / (provenanceOrder.length - 1)) * 100;

  if (compact) {
    // Compact inline version for feed view
    return (
      <div className="relative inline-flex items-center">
        <button
          className={`
            flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
            ${currentConfig.bgColor} ${currentConfig.borderColor} border
            hover:opacity-80 transition-opacity
          `}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={(e) => {
            e.stopPropagation();
            setShowTooltip(!showTooltip);
          }}
        >
          <span>{currentConfig.icon}</span>
          <span className={currentConfig.color}>{currentConfig.shortLabel}</span>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 bg-[#1a1d29] rounded-lg border border-gray-700 shadow-xl">
            {/* Mini spectrum */}
            <div className="mb-3">
              <div className="text-2xs text-gray-500 mb-1.5">Source Access Key</div>
              <div className="relative h-1.5 rounded-full overflow-hidden bg-gray-800">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: '100%',
                    background: `linear-gradient(to right, ${Object.values(spectrumColors).join(', ')})`,
                  }}
                />
              </div>
              {/* Position indicator */}
              <div
                className="relative w-3 h-3 -mt-[9px] rounded-full border-2 border-white shadow-lg"
                style={{
                  marginLeft: `calc(${spectrumPosition}% - 6px)`,
                  backgroundColor: spectrumColors[provenance.type],
                }}
              />
            </div>

            {/* Current type info */}
            <div className={`text-sm font-semibold ${currentConfig.color} mb-1`}>
              {currentConfig.icon} {currentConfig.label}
            </div>
            <p className="text-xs text-gray-400 mb-2">{currentConfig.description}</p>

            {/* Details */}
            <ul className="space-y-1">
              {currentConfig.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2 text-caption text-gray-500">
                  <span className={`mt-1 w-1 h-1 rounded-full ${currentConfig.bgColor.replace('/10', '')}`} />
                  {detail}
                </li>
              ))}
            </ul>

            {/* Custom description if provided */}
            {provenance.description && provenance.description !== currentConfig.description && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <p className="text-caption text-gray-400 italic">{provenance.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full expanded version for detail view
  return (
    <div className="space-y-3">
      {/* Section header */}
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        Source Access Key
      </h4>

      {/* Spectrum bar */}
      <div className="relative">
        <div className="h-2 rounded-full overflow-hidden bg-gray-800">
          <div
            className="h-full rounded-full"
            style={{
              width: '100%',
              background: `linear-gradient(to right, ${Object.values(spectrumColors).join(', ')})`,
            }}
          />
        </div>

        {/* Position indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-300"
          style={{
            left: `calc(${spectrumPosition}% - 8px)`,
            backgroundColor: spectrumColors[provenance.type],
          }}
        />

        {/* Labels below spectrum */}
        <div className="flex justify-between mt-2 text-2xs text-gray-500">
          <span>Close to event</span>
          <span>Further from event</span>
        </div>
      </div>

      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5">
        {provenanceOrder.map((type) => {
          const config = provenanceConfig[type];
          const isActive = type === provenance.type;
          const isHovered = type === hoveredType;

          return (
            <button
              key={type}
              className={`
                relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                border transition-all duration-200
                ${isActive
                  ? `${config.bgColor} ${config.borderColor} ${config.color}`
                  : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                }
              `}
              onMouseEnter={() => setHoveredType(type)}
              onMouseLeave={() => setHoveredType(null)}
            >
              <span>{config.icon}</span>
              <span className="font-medium">{config.shortLabel}</span>

              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute left-0 top-full mt-2 z-50 w-56 p-3 bg-[#1a1d29] rounded-lg border border-gray-700 shadow-xl">
                  <div className={`text-sm font-semibold ${config.color} mb-1`}>
                    {config.label}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{config.description}</p>
                  <ul className="space-y-1">
                    {config.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-caption text-gray-500">
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: spectrumColors[type] }} />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Current source description */}
      {provenance.description && (
        <p className="text-xs text-gray-500 italic pl-1 border-l-2 border-gray-700">
          {provenance.description}
        </p>
      )}
    </div>
  );
}
