import { WatchpointId } from '@/types';
import { tier1Sources, tier2Sources, tier3Sources, TieredSource } from './sources-clean';

// =============================================================================
// DYNAMIC ACTIVITY DETECTION
// =============================================================================
// Baselines are calculated from source postsPerDay values.
//
// TRUST LEVELS:
// - Decimal values (37.9, 16.6) = measured from actual data → trust these
// - Round numbers (50, 30, 15) = guessed/estimated → use conservative default
//
// This prevents inflated guesses from skewing the baseline.
// =============================================================================

const CONSERVATIVE_DEFAULT = 3; // posts/day for guessed sources

// Check if a number was likely measured (has decimals) vs guessed (round)
function isMeasuredValue(n: number): boolean {
  return n !== Math.floor(n);
}

// Calculate 6-hour baseline per region from source postsPerDay
function calculateDynamicBaselines(): Record<WatchpointId, number> {
  const allSources = [...tier1Sources, ...tier2Sources, ...tier3Sources];

  const regionTotals: Record<string, number> = {
    'us': 0,
    'latam': 0,
    'middle-east': 0,
    'europe-russia': 0,
    'asia': 0,
    'all': 0,
    'seismic': 0,
  };

  for (const source of allSources) {
    const rawValue = source.postsPerDay || 0;
    // Trust measured decimals, use conservative default for round guesses
    const postsPerDay = isMeasuredValue(rawValue) ? rawValue : CONSERVATIVE_DEFAULT;
    const region = source.region;

    // Add to specific region
    if (region in regionTotals) {
      regionTotals[region] += postsPerDay;
    }

    // All sources contribute to 'all' total
    regionTotals['all'] += postsPerDay;
  }

  // Convert postsPerDay to posts per 6 hours (divide by 4)
  const baselines: Record<WatchpointId, number> = {} as Record<WatchpointId, number>;
  for (const [region, total] of Object.entries(regionTotals)) {
    baselines[region as WatchpointId] = Math.round(total / 4);
  }

  return baselines;
}

// Calculate once at module load
const REGION_BASELINES_6H = calculateDynamicBaselines();

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
    //
    // Requirements:
    // - Raised thresholds: 2.5x for elevated, 5x for critical (was 2x/4x)
    // - Minimum post count: need at least 25 posts to trigger elevated, 50 for critical
    //   This prevents low-source regions (Asia) from false positives
    let level: RegionActivity['level'];
    const MIN_ELEVATED_COUNT = 25;
    const MIN_CRITICAL_COUNT = 50;

    if (multiplier >= 5 && count >= MIN_CRITICAL_COUNT) level = 'critical';
    else if (multiplier >= 2.5 && count >= MIN_ELEVATED_COUNT) level = 'elevated';
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
