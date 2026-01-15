// Watchpoint regions
export type WatchpointId =
  | 'middle-east'
  | 'ukraine-russia'
  | 'china-taiwan'
  | 'venezuela'
  | 'us-domestic'
  | 'seismic'
  | 'all';

// =============================================================================
// SEISMIC / EARTHQUAKE DATA
// =============================================================================

export interface Earthquake {
  id: string;
  magnitude: number;
  place: string;
  time: Date;
  coordinates: [number, number, number]; // [longitude, latitude, depth in km]
  url: string;
  tsunami: boolean;
  felt: number | null; // Number of felt reports
  alert: 'green' | 'yellow' | 'orange' | 'red' | null;
  significance: number; // USGS significance score 0-1000+
  depth: number; // km
}

export interface Watchpoint {
  id: WatchpointId;
  name: string;
  shortName: string;
  priority: number;
  activityLevel: 'low' | 'normal' | 'elevated' | 'high' | 'critical';
  color: string;
}

// Source tiers (information cascade)
export type SourceTier = 'official' | 'reporter' | 'osint' | 'ground';

// =============================================================================
// SOURCE ACTIVITY TRACKING
// =============================================================================
// Detect when a source is posting more than usual

export interface SourceActivityProfile {
  sourceId: string;
  // Baseline: average posts per day (calculated from historical data)
  baselinePostsPerDay: number;
  // Recent: posts in the last tracking window
  recentPosts: number;
  recentWindowHours: number;
  // Anomaly detection
  anomalyRatio: number; // recent_rate / baseline_rate (>1 = above normal)
  isAnomalous: boolean; // true if significantly above baseline
}

export interface Source {
  id: string;
  name: string;
  handle?: string;
  platform: 'bluesky' | 'rss' | 'twitter' | 'telegram' | 'reddit';
  tier: SourceTier;
  confidence: number; // 1-100
  region: WatchpointId;
  url?: string;
  // Expected posting frequency (posts per day, for anomaly detection)
  baselinePostsPerDay?: number;
}

// Alert status (deprecated - keeping for backward compatibility)
export type AlertStatus = 'first' | 'developing' | 'confirmed' | null;

// News item
export type VerificationStatus = 'unverified' | 'multiple-sources' | 'confirmed';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: Source;
  timestamp: Date;
  region: WatchpointId;
  verificationStatus: VerificationStatus;
  url?: string;

  // DEPRECATED: Old cascade system
  alertStatus?: AlertStatus;
  isBreaking?: boolean;
  confirmsSource?: string;

  // For grouping similar stories
  relatedItems?: string[];
  clusterId?: string;

  // Activity anomaly indicators
  // Shows if this source is posting more than usual
  sourceActivity?: {
    isAnomalous: boolean;
    anomalyRatio: number; // 2.0 = posting at 2x normal rate
    recentCount: number;  // "5 posts in 2 hours"
    windowHours: number;
    baseline: number;     // "usually 1/day"
  };
}

// =============================================================================
// REGIONAL SURGE DETECTION
// =============================================================================
// When multiple sources for a region are posting above baseline

export interface RegionalSurge {
  region: WatchpointId;
  anomalousSources: number;     // How many sources are above baseline
  totalActiveSources: number;   // How many sources are posting at all
  surgeRatio: number;           // anomalous / total
  isSurging: boolean;           // True if significant surge detected
  topContributors: string[];    // Source names driving the surge
}

// Activity level for watchpoints
export interface ActivityData {
  watchpointId: WatchpointId;
  currentLevel: number; // 0-100
  baselineLevel: number; // 0-100
  trend: 'rising' | 'falling' | 'stable';
  lastUpdated: Date;
}
