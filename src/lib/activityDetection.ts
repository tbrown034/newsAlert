import { WatchpointId } from '@/types';

// =============================================================================
// SIMPLIFIED ACTIVITY DETECTION
// =============================================================================
// Just count posts per region vs baseline - that's it.
// =============================================================================

// Expected posts per hour under "normal" conditions
const REGION_BASELINES: Record<WatchpointId, number> = {
  'middle-east': 8,
  'ukraine': 10,
  'china-taiwan': 3,
  'latam': 2,
  'us-domestic': 4,
  'seismic': 0,
  'all': 20,
};

export interface RegionActivity {
  level: 'critical' | 'high' | 'elevated' | 'normal' | 'low';
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
 */
export function calculateRegionActivity(
  items: { region: WatchpointId; timestamp: Date }[]
): Record<WatchpointId, RegionActivity> {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  const regions: WatchpointId[] = [
    'middle-east',
    'ukraine',
    'china-taiwan',
    'latam',
    'us-domestic',
  ];

  // Count posts per region in single pass
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (now - item.timestamp.getTime() < oneHour) {
      counts[item.region] = (counts[item.region] || 0) + 1;
    }
  }

  // Calculate activity levels
  const activity = {} as Record<WatchpointId, RegionActivity>;

  for (const region of regions) {
    const count = counts[region] || 0;
    const baseline = REGION_BASELINES[region] || 5;
    const multiplier = baseline > 0 ? Math.round((count / baseline) * 10) / 10 : 0;
    const percentChange = baseline > 0 ? Math.round(((count - baseline) / baseline) * 100) : 0;

    let level: RegionActivity['level'];
    if (multiplier >= 3) level = 'critical';
    else if (multiplier >= 2) level = 'high';
    else if (multiplier >= 1.5) level = 'elevated';
    else if (multiplier >= 0.5) level = 'normal';
    else level = 'low';

    let vsNormal: 'above' | 'below' | 'normal';
    if (multiplier >= 1.3) vsNormal = 'above';
    else if (multiplier <= 0.7) vsNormal = 'below';
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
