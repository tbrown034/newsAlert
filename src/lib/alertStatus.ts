import { NewsItem, AlertStatus, SourceTier } from '@/types';

// =============================================================================
// SIMPLIFIED ALERT STATUS LOGIC
// =============================================================================
// Just keyword detection - O(n) instead of O(n²)
// Activity levels handle "something is happening" signal
// =============================================================================

// Keywords that indicate significant news worth alerting
const ALERT_KEYWORDS = [
  // Breaking/urgent prefixes
  'breaking', 'urgent', 'alert', 'just in', 'developing',
  // Military/conflict
  'strike', 'attack', 'explosion', 'missile', 'drone', 'airstrike',
  'troops', 'military', 'invasion', 'offensive',
  // Diplomatic/political crisis
  'ceasefire', 'hostage', 'assassination', 'coup',
  'martial law', 'emergency', 'sanctions',
  // Critical infrastructure
  'nuclear', 'chemical', 'embassy', 'evacuate',
  // Civil unrest
  'protests', 'riot', 'crackdown', 'killed', 'casualties',
];

// Check if content contains alert keywords
function hasAlertKeywords(title: string): boolean {
  const text = title.toLowerCase();
  return ALERT_KEYWORDS.some((kw) => text.includes(kw));
}

// Simple alert status - just keyword detection
export function determineAlertStatus(item: NewsItem): AlertStatus {
  const hasKeywords = hasAlertKeywords(item.title);

  if (!hasKeywords) {
    return null;
  }

  // OSINT/ground sources with keywords = FIRST
  if (item.source.tier === 'osint' || item.source.tier === 'ground') {
    const ageMs = Date.now() - item.timestamp.getTime();
    const thirtyMinutes = 30 * 60 * 1000;

    if (ageMs < thirtyMinutes) {
      return 'first';
    }
  }

  // Official/reporter sources with keywords = CONFIRMED
  if (item.source.tier === 'official' || item.source.tier === 'reporter') {
    return 'confirmed';
  }

  return null;
}

// Process all items - O(n) single pass
export function processAlertStatuses(items: NewsItem[]): NewsItem[] {
  return items.map((item) => ({
    ...item,
    alertStatus: determineAlertStatus(item),
  }));
}

// Simple chronological sort (activity levels handle priority now)
export function sortByCascadePriority(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    // Items with alert status float to top
    const aHasAlert = a.alertStatus ? 1 : 0;
    const bHasAlert = b.alertStatus ? 1 : 0;
    if (aHasAlert !== bHasAlert) return bHasAlert - aHasAlert;

    // Then by recency
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}
