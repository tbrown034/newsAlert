/**
 * SOURCE BLOCKLIST
 * =================
 * Sources we've evaluated and rejected. Don't re-add these.
 *
 * Format: { id, name, reason, dateBlocked }
 */

export const blockedSources = [
  {
    id: 'kathmandu-post-rss',
    name: 'Kathmandu Post',
    reason: 'Low value/credibility, worldwide aggregator miscategorized as Asia-specific, pollutes regional feeds with off-topic content',
    dateBlocked: '2025-01-19',
  },
  {
    id: 'dark-reading-rss',
    name: 'Dark Reading',
    reason: 'Cybersecurity only, no geopolitical relevance',
    dateBlocked: '2026-01-20',
  },
  {
    id: 'marginal-revolution-rss',
    name: 'Marginal Revolution',
    reason: 'Economics blog, off-topic',
    dateBlocked: '2026-01-20',
  },
  {
    id: 'bleeping-computer-rss',
    name: 'Bleeping Computer',
    reason: 'Tech news only, no geopolitical relevance',
    dateBlocked: '2026-01-20',
  },
  {
    id: 'socialistdogmom',
    name: 'Molly Conger',
    reason: 'Off-topic, user requested removal',
    dateBlocked: '2026-01-20',
  },
  {
    id: 'telegraph-rss',
    name: 'The Telegraph',
    reason: 'HTTP 403 - blocks RSS requests, paywall',
    dateBlocked: '2026-01-29',
  },
  {
    id: 'youtube-memritv',
    name: 'MEMRI TV',
    reason: 'YouTube channel ID invalid (404), channel may have been removed or ID changed',
    dateBlocked: '2026-01-29',
  },
];

// Quick lookup
export const blockedSourceIds = new Set(blockedSources.map(s => s.id));
