'use client';

import { Watchpoint, WatchpointId } from '@/types';

interface WatchpointSelectorProps {
  watchpoints: Watchpoint[];
  selected: WatchpointId;
  onSelect: (id: WatchpointId) => void;
}

const activityDots: Record<string, string> = {
  low: 'bg-emerald-500',
  normal: 'bg-blue-500',
  elevated: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function WatchpointSelector({
  watchpoints,
  selected,
  onSelect,
}: WatchpointSelectorProps) {
  const allItems = [
    { id: 'all' as WatchpointId, shortName: 'All', activityLevel: 'normal' as const },
    ...watchpoints,
  ];

  return (
    <div className="flex overflow-x-auto scrollbar-hide">
      {allItems.map((wp) => {
        const isSelected = selected === wp.id;
        const isHot = wp.activityLevel === 'high' || wp.activityLevel === 'critical';

        return (
          <button
            key={wp.id}
            onClick={() => onSelect(wp.id)}
            className={`
              relative flex-1 min-w-[80px] py-4 text-news font-medium
              transition-colors duration-150
              ${isSelected ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'}
            `}
          >
            <div className="flex items-center justify-center gap-1.5">
              {wp.id !== 'all' && (
                <span
                  className={`w-2 h-2 rounded-full ${activityDots[wp.activityLevel]} ${
                    isHot ? 'animate-pulse' : ''
                  }`}
                />
              )}
              <span>{wp.shortName}</span>
            </div>

            {/* Active indicator bar */}
            {isSelected && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
