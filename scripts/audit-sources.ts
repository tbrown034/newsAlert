/**
 * Source Audit Script
 * ===================
 * Checks every Bluesky source for:
 * - Account exists
 * - Last post date
 * - Post frequency
 * - Generates tier recommendations
 */

import { allSources } from '../src/lib/sources';

interface AuditResult {
  id: string;
  name: string;
  handle: string;
  region: string;
  currentTier: string;

  // API results
  exists: boolean;
  error?: string;

  // Activity metrics
  lastPostDate?: Date;
  daysSinceLastPost?: number;
  postsInLast24h: number;
  postsInLast7d: number;
  postsInLast30d: number;

  // Recommendation
  recommendedTier: 'T1' | 'T2' | 'T3' | 'DELETE';
  reason: string;
}

async function fetchAccountActivity(handle: string): Promise<{
  exists: boolean;
  error?: string;
  posts: { createdAt: Date }[];
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Extract handle from URL format if needed
    let cleanHandle = handle;
    const match = handle.match(/bsky\.app\/profile\/([^\/]+)/);
    if (match) {
      cleanHandle = match[1];
    }

    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${cleanHandle}&limit=100`;

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 400) {
        return { exists: false, error: `Invalid handle or account not found`, posts: [] };
      }
      if (response.status === 404) {
        return { exists: false, error: `Account not found (404)`, posts: [] };
      }

      return { exists: false, error: `API error ${response.status}: ${errorData.error || 'Unknown'}`, posts: [] };
    }

    const data = await response.json();
    const posts = (data.feed || []).map((item: any) => ({
      createdAt: new Date(item.post?.record?.createdAt || item.post?.indexedAt || 0),
    }));

    return { exists: true, posts };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return { exists: false, error: 'Timeout (10s)', posts: [] };
    }

    return { exists: false, error: err.message, posts: [] };
  }
}

function calculateTier(result: AuditResult): { tier: 'T1' | 'T2' | 'T3' | 'DELETE'; reason: string } {
  // Account doesn't exist
  if (!result.exists) {
    return { tier: 'DELETE', reason: result.error || 'Account not found' };
  }

  // Never posted or no posts found
  if (!result.lastPostDate) {
    return { tier: 'DELETE', reason: 'No posts found' };
  }

  const days = result.daysSinceLastPost || 999;

  // Dormant > 90 days
  if (days > 90) {
    return { tier: 'DELETE', reason: `Dormant ${days} days` };
  }

  // Inactive 30-90 days
  if (days > 30) {
    return { tier: 'T3', reason: `Inactive ${days} days, but may return` };
  }

  // Semi-active: posted in last 30 days but not very frequent
  if (days > 7 || result.postsInLast7d < 3) {
    return { tier: 'T2', reason: `Semi-active: ${result.postsInLast7d} posts in 7 days` };
  }

  // Active: frequent poster
  if (result.postsInLast7d >= 10 || result.postsInLast24h >= 2) {
    return { tier: 'T1', reason: `Very active: ${result.postsInLast24h}/day, ${result.postsInLast7d}/week` };
  }

  // Default to T2
  return { tier: 'T2', reason: `Moderate activity: ${result.postsInLast7d} posts in 7 days` };
}

async function auditSource(source: typeof allSources[0]): Promise<AuditResult> {
  const handle = source.feedUrl.match(/bsky\.app\/profile\/([^\/]+)/)?.[1] || source.handle || 'unknown';

  const { exists, error, posts } = await fetchAccountActivity(handle);

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const postsInLast24h = posts.filter(p => p.createdAt.getTime() > oneDayAgo).length;
  const postsInLast7d = posts.filter(p => p.createdAt.getTime() > sevenDaysAgo).length;
  const postsInLast30d = posts.filter(p => p.createdAt.getTime() > thirtyDaysAgo).length;

  const lastPostDate = posts.length > 0 ? posts[0].createdAt : undefined;
  const daysSinceLastPost = lastPostDate
    ? Math.floor((now - lastPostDate.getTime()) / (24 * 60 * 60 * 1000))
    : undefined;

  const result: AuditResult = {
    id: source.id,
    name: source.name,
    handle,
    region: source.region,
    currentTier: source.tier,
    exists,
    error,
    lastPostDate,
    daysSinceLastPost,
    postsInLast24h,
    postsInLast7d,
    postsInLast30d,
    recommendedTier: 'T2',
    reason: '',
  };

  const { tier, reason } = calculateTier(result);
  result.recommendedTier = tier;
  result.reason = reason;

  return result;
}

async function main() {
  // Filter to only Bluesky sources
  const blueskySources = allSources.filter(
    s => s.platform === 'bluesky' || s.feedUrl.includes('bsky.app')
  );

  console.log(`\n📊 BLUESKY SOURCE AUDIT`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Total sources to audit: ${blueskySources.length}\n`);

  const results: AuditResult[] = [];
  const batchSize = 20;
  const batchDelay = 500; // Be nice to the API

  for (let i = 0; i < blueskySources.length; i += batchSize) {
    const batch = blueskySources.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(blueskySources.length / batchSize);

    process.stdout.write(`Batch ${batchNum}/${totalBatches}... `);

    const batchResults = await Promise.all(batch.map(auditSource));
    results.push(...batchResults);

    const t1 = batchResults.filter(r => r.recommendedTier === 'T1').length;
    const t2 = batchResults.filter(r => r.recommendedTier === 'T2').length;
    const t3 = batchResults.filter(r => r.recommendedTier === 'T3').length;
    const del = batchResults.filter(r => r.recommendedTier === 'DELETE').length;

    console.log(`T1:${t1} T2:${t2} T3:${t3} DEL:${del}`);

    if (i + batchSize < blueskySources.length) {
      await new Promise(r => setTimeout(r, batchDelay));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📈 AUDIT SUMMARY\n`);

  const t1 = results.filter(r => r.recommendedTier === 'T1');
  const t2 = results.filter(r => r.recommendedTier === 'T2');
  const t3 = results.filter(r => r.recommendedTier === 'T3');
  const toDelete = results.filter(r => r.recommendedTier === 'DELETE');

  console.log(`T1 (Critical - fetch first):     ${t1.length} accounts`);
  console.log(`T2 (Standard - async fetch):     ${t2.length} accounts`);
  console.log(`T3 (Archive - on-demand):        ${t3.length} accounts`);
  console.log(`DELETE (remove):                 ${toDelete.length} accounts`);
  console.log(`\nTotal: ${results.length}`);

  // T1 accounts
  if (t1.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n🔥 TIER 1 - CRITICAL (${t1.length} accounts)\n`);
    t1.sort((a, b) => b.postsInLast24h - a.postsInLast24h).forEach(r => {
      console.log(`  ${r.name} (@${r.handle})`);
      console.log(`    Region: ${r.region} | 24h: ${r.postsInLast24h} | 7d: ${r.postsInLast7d}`);
      console.log(`    ${r.reason}`);
      console.log('');
    });
  }

  // Accounts to delete
  if (toDelete.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n❌ RECOMMENDED FOR DELETION (${toDelete.length} accounts)\n`);

    // Group by reason
    const byReason = new Map<string, AuditResult[]>();
    toDelete.forEach(r => {
      const key = r.error || r.reason;
      if (!byReason.has(key)) byReason.set(key, []);
      byReason.get(key)!.push(r);
    });

    for (const [reason, accounts] of byReason) {
      console.log(`\n📛 ${reason} (${accounts.length}):`);
      accounts.slice(0, 20).forEach(r => {
        console.log(`   - ${r.name} (@${r.handle}) [${r.region}]`);
      });
      if (accounts.length > 20) {
        console.log(`   ... and ${accounts.length - 20} more`);
      }
    }
  }

  // Write detailed results to JSON
  const outputPath = '/tmp/source-audit-results.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n\n📁 Full results saved to: ${outputPath}`);

  // Write tier recommendations to a more readable format
  const tierReportPath = '/tmp/source-tier-report.md';
  let report = `# Source Tier Audit Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n`;
  report += `- T1 (Critical): ${t1.length}\n`;
  report += `- T2 (Standard): ${t2.length}\n`;
  report += `- T3 (Archive): ${t3.length}\n`;
  report += `- Delete: ${toDelete.length}\n\n`;

  report += `## T1 - Critical Sources (${t1.length})\n\n`;
  t1.forEach(r => {
    report += `- **${r.name}** (@${r.handle}) - ${r.region}\n`;
    report += `  - 24h: ${r.postsInLast24h} | 7d: ${r.postsInLast7d} | ${r.reason}\n`;
  });

  report += `\n## T2 - Standard Sources (${t2.length})\n\n`;
  t2.forEach(r => {
    report += `- **${r.name}** (@${r.handle}) - ${r.region}\n`;
    report += `  - 7d: ${r.postsInLast7d} | ${r.reason}\n`;
  });

  report += `\n## T3 - Archive Sources (${t3.length})\n\n`;
  t3.forEach(r => {
    report += `- **${r.name}** (@${r.handle}) - ${r.region}\n`;
    report += `  - Last post: ${r.daysSinceLastPost} days ago | ${r.reason}\n`;
  });

  report += `\n## Recommended for Deletion (${toDelete.length})\n\n`;
  toDelete.forEach(r => {
    report += `- **${r.name}** (@${r.handle}) - ${r.region}\n`;
    report += `  - Reason: ${r.reason}\n`;
  });

  fs.writeFileSync(tierReportPath, report);
  console.log(`📄 Tier report saved to: ${tierReportPath}`);
}

main().catch(console.error);
