import { WatchpointId } from '@/types';

// =============================================================================
// SIMPLIFIED ACTIVITY DETECTION
// =============================================================================
// Count total posts per region in the 6h window, compare to 6h baseline.
// If we usually see 100 posts and we're seeing 232, that's a surge.
// =============================================================================

// Expected posts per 6-HOUR WINDOW under "normal" conditions
// These should reflect a typical 6-hour period, not a quiet one
const REGION_BASELINES_6H: Record<WatchpointId, number> = {
  'us': 60,           // ~10/hour × 6
  'latam': 36,        // ~6/hour × 6
  'middle-east': 90,  // ~15/hour × 6
  'europe-russia': 108, // ~18/hour × 6
  'asia': 60,         // ~10/hour × 6
  'seismic': 0,
  'all': 300,         // ~50/hour × 6
};

export interface RegionActivity {
  level: 'critical' | 'elevated' | 'normal';
  count: number;
  baseline: number;
  multiplier: number;
  // For compatibility with UI
  breaking: number;
  vsNormal: 'above' | 'below' | 'normal';
  percentChange: number;
}

/**
 * Calculate activity level for all regions - O(n) single pass
 * Items passed in are already filtered to the 6h window by the API
 */
export function calculateRegionActivity(
  items: { region: WatchpointId; timestamp: Date }[]
): Record<WatchpointId, RegionActivity> {
  const regions: WatchpointId[] = [
    'us',
    'latam',
    'middle-east',
    'europe-russia',
    'asia',
  ];

  // Count ALL posts per region (items are already 6h filtered by API)
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.region] = (counts[item.region] || 0) + 1;
  }

  // Calculate activity levels
  const activity = {} as Record<WatchpointId, RegionActivity>;

  for (const region of regions) {
    const count = counts[region] || 0;
    const baseline = REGION_BASELINES_6H[region] || 30;
    const multiplier = baseline > 0 ? Math.round((count / baseline) * 10) / 10 : 0;
    const percentChange = baseline > 0 ? Math.round(((count - baseline) / baseline) * 100) : 0;

    // Critical = major crisis (Israel/Iran, large-scale protests, etc.)
    // Elevated = notable activity worth watching
    // Normal = typical news day
    let level: RegionActivity['level'];
    if (multiplier >= 4) level = 'critical';
    else if (multiplier >= 2) level = 'elevated';
    else level = 'normal';

    let vsNormal: 'above' | 'below' | 'normal';
    if (multiplier >= 1.5) vsNormal = 'above';
    else if (multiplier <= 0.5) vsNormal = 'below';
    else vsNormal = 'normal';

    activity[region] = {
      level,
      count,
      baseline,
      multiplier,
      breaking: 0, // Simplified - we don't track breaking separately
      vsNormal,
      percentChange,
    };
  }

  return activity;
}
