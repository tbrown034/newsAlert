import { WatchpointId } from '@/types';

// =============================================================================
// SIMPLIFIED ACTIVITY DETECTION
// =============================================================================
// Just count posts per region vs baseline - that's it.
// =============================================================================

// Expected posts per hour under "normal" conditions
// These should reflect a typical news day, not a quiet one
const REGION_BASELINES: Record<WatchpointId, number> = {
  'us': 10,
  'latam': 6,
  'middle-east': 15,
  'europe-russia': 18,
  'asia': 10,
  'seismic': 0,
  'all': 50,
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
 */
export function calculateRegionActivity(
  items: { region: WatchpointId; timestamp: Date }[]
): Record<WatchpointId, RegionActivity> {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  const regions: WatchpointId[] = [
    'us',
    'latam',
    'middle-east',
    'europe-russia',
    'asia',
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
