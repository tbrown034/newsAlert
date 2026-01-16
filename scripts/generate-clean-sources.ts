/**
 * Generate Clean Sources File
 * ===========================
 * Uses audit results to create a new sources.ts with:
 * - Only valid accounts (T1, T2, T3)
 * - Tier field
 * - Actual posting rates
 */

import * as fs from 'fs';

interface AuditResult {
  id: string;
  name: string;
  handle: string;
  region: string;
  currentTier: string;
  exists: boolean;
  error?: string;
  lastPostDate?: string;
  daysSinceLastPost?: number;
  postsInLast24h: number;
  postsInLast7d: number;
  postsInLast30d: number;
  recommendedTier: 'T1' | 'T2' | 'T3' | 'DELETE';
  reason: string;
}

// Read audit results
const auditData: AuditResult[] = JSON.parse(
  fs.readFileSync('/tmp/source-audit-results.json', 'utf-8')
);

// Filter to keep only valid accounts
const validAccounts = auditData.filter(a => a.recommendedTier !== 'DELETE');

console.log(`\n📊 Generating clean sources file`);
console.log(`Original: ${auditData.length} accounts`);
console.log(`Keeping: ${validAccounts.length} accounts\n`);

// Group by tier
const t1 = validAccounts.filter(a => a.recommendedTier === 'T1');
const t2 = validAccounts.filter(a => a.recommendedTier === 'T2');
const t3 = validAccounts.filter(a => a.recommendedTier === 'T3');

console.log(`T1 (Critical): ${t1.length}`);
console.log(`T2 (Standard): ${t2.length}`);
console.log(`T3 (Archive): ${t3.length}`);

// Calculate actual posts per day
function getPostsPerDay(account: AuditResult): number {
  if (account.postsInLast7d > 0) {
    return Math.round((account.postsInLast7d / 7) * 10) / 10;
  }
  if (account.postsInLast30d > 0) {
    return Math.round((account.postsInLast30d / 30) * 10) / 10;
  }
  return 0.1; // Rarely posts
}

// Map region names
function mapRegion(region: string): string {
  const regionMap: Record<string, string> = {
    'middle-east': 'middle-east',
    'ukraine': 'ukraine',
    'china-taiwan': 'china-taiwan',
    'latam': 'latam',
    'us-domestic': 'us-domestic',
    'all': 'all',
  };
  return regionMap[region] || 'all';
}

// Generate TypeScript source
function generateSource(account: AuditResult): string {
  const postsPerDay = getPostsPerDay(account);
  const region = mapRegion(account.region);
  const tier = account.recommendedTier;

  // Determine source tier (osint, reporter, official, ground)
  const sourceTier = account.currentTier || 'osint';

  return `  {
    id: '${account.id}',
    name: '${account.name.replace(/'/g, "\\'")}',
    handle: '@${account.handle}',
    platform: 'bluesky',
    tier: '${sourceTier}',
    fetchTier: '${tier}',
    confidence: 80,
    region: '${region}' as WatchpointId,
    feedUrl: 'https://bsky.app/profile/${account.handle}',
    url: 'https://bsky.app/profile/${account.handle}',
    postsPerDay: ${postsPerDay},
  }`;
}

// Generate the file content
let output = `import { Source, WatchpointId } from '@/types';

// =============================================================================
// VERIFIED BLUESKY SOURCES - Generated ${new Date().toISOString().split('T')[0]}
// =============================================================================
// Sources have been audited and tiered:
// - T1 (Critical): Very active, fetch first
// - T2 (Standard): Semi-active, fetch async
// - T3 (Archive): Occasionally active, fetch on-demand
// =============================================================================

export type FetchTier = 'T1' | 'T2' | 'T3';

export interface TieredSource extends Source {
  feedUrl: string;
  fetchTier: FetchTier;
  postsPerDay: number;
}

// -----------------------------------------------------------------------------
// T1 - CRITICAL SOURCES (${t1.length}) - Fetch first, always
// -----------------------------------------------------------------------------
export const tier1Sources: TieredSource[] = [
${t1.map(generateSource).join(',\n')}
];

// -----------------------------------------------------------------------------
// T2 - STANDARD SOURCES (${t2.length}) - Fetch async, animate in
// -----------------------------------------------------------------------------
export const tier2Sources: TieredSource[] = [
${t2.map(generateSource).join(',\n')}
];

// -----------------------------------------------------------------------------
// T3 - ARCHIVE SOURCES (${t3.length}) - Fetch on-demand
// -----------------------------------------------------------------------------
export const tier3Sources: TieredSource[] = [
${t3.map(generateSource).join(',\n')}
];

// -----------------------------------------------------------------------------
// COMBINED EXPORTS
// -----------------------------------------------------------------------------
export const allTieredSources: TieredSource[] = [
  ...tier1Sources,
  ...tier2Sources,
  ...tier3Sources,
];

export function getSourcesByTier(tier: FetchTier): TieredSource[] {
  switch (tier) {
    case 'T1': return tier1Sources;
    case 'T2': return tier2Sources;
    case 'T3': return tier3Sources;
  }
}

export function getSourcesByRegion(region: WatchpointId): TieredSource[] {
  if (region === 'all') return allTieredSources;
  return allTieredSources.filter(s => s.region === region || s.region === 'all');
}

// Legacy export for compatibility
export const allSources = allTieredSources;
`;

// Write to file
const outputPath = '/Users/trevorbrown/Desktop/ActiveProjects/newsAlert/src/lib/sources-clean.ts';
fs.writeFileSync(outputPath, output);
console.log(`\n✅ Generated: ${outputPath}`);

// Summary by region
console.log('\n📍 By Region:');
const regions = ['middle-east', 'ukraine', 'china-taiwan', 'latam', 'us-domestic', 'all'];
for (const region of regions) {
  const count = validAccounts.filter(a => a.region === region).length;
  if (count > 0) {
    console.log(`   ${region}: ${count}`);
  }
}
