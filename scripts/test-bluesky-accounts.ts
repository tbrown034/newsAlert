/**
 * Bluesky Account Performance Diagnostic
 * Tests all accounts and reports slow/failing ones
 */

import { allSources } from '../src/lib/sources';

interface AccountResult {
  name: string;
  handle: string;
  time: number;
  status: 'ok' | 'slow' | 'timeout' | 'error';
  error?: string;
  postCount?: number;
}

async function testAccount(source: { name: string; feedUrl: string }): Promise<AccountResult> {
  const match = source.feedUrl.match(/bsky\.app\/profile\/([^\/]+)/);
  const handle = match ? match[1] : 'unknown';

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=5`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        name: source.name,
        handle,
        time: elapsed,
        status: 'error',
        error: `${response.status}: ${errorData.error || 'Unknown error'}`,
      };
    }

    const data = await response.json();
    const postCount = data.feed?.length || 0;

    return {
      name: source.name,
      handle,
      time: elapsed,
      status: elapsed > 2000 ? 'slow' : 'ok',
      postCount,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;

    if (err.name === 'AbortError') {
      return {
        name: source.name,
        handle,
        time: elapsed,
        status: 'timeout',
        error: 'Request timed out (5s)',
      };
    }

    return {
      name: source.name,
      handle,
      time: elapsed,
      status: 'error',
      error: err.message,
    };
  }
}

async function main() {
  // Filter to only Bluesky sources
  const blueskySources = allSources.filter(
    s => s.platform === 'bluesky' || s.feedUrl.includes('bsky.app')
  );

  console.log(`\n📊 Testing ${blueskySources.length} Bluesky accounts...\n`);
  console.log('=' .repeat(70));

  const results: AccountResult[] = [];
  const batchSize = 20;

  for (let i = 0; i < blueskySources.length; i += batchSize) {
    const batch = blueskySources.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(blueskySources.length / batchSize);

    process.stdout.write(`Batch ${batchNum}/${totalBatches}... `);

    const batchResults = await Promise.all(batch.map(testAccount));
    results.push(...batchResults);

    const ok = batchResults.filter(r => r.status === 'ok').length;
    const slow = batchResults.filter(r => r.status === 'slow').length;
    const errors = batchResults.filter(r => r.status === 'error' || r.status === 'timeout').length;

    console.log(`✓ ${ok} ok, ⚠ ${slow} slow, ✗ ${errors} errors`);

    // Small delay between batches
    if (i + batchSize < blueskySources.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Sort by time descending
  results.sort((a, b) => b.time - a.time);

  // Summary
  console.log('\n' + '=' .repeat(70));
  console.log('\n📈 SUMMARY\n');

  const ok = results.filter(r => r.status === 'ok');
  const slow = results.filter(r => r.status === 'slow');
  const timeouts = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');

  console.log(`✓ OK (< 2s):     ${ok.length} accounts`);
  console.log(`⚠ Slow (> 2s):   ${slow.length} accounts`);
  console.log(`⏱ Timeouts:      ${timeouts.length} accounts`);
  console.log(`✗ Errors:        ${errors.length} accounts`);

  // Average response time
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  console.log(`\n⏱ Average response time: ${Math.round(avgTime)}ms`);

  // Slowest accounts
  if (slow.length > 0 || timeouts.length > 0) {
    console.log('\n' + '=' .repeat(70));
    console.log('\n🐌 SLOWEST ACCOUNTS (> 2s)\n');

    [...slow, ...timeouts].slice(0, 20).forEach((r, i) => {
      console.log(`${i + 1}. ${r.name}`);
      console.log(`   Handle: @${r.handle}`);
      console.log(`   Time: ${r.time}ms`);
      console.log(`   Status: ${r.status}`);
      if (r.error) console.log(`   Error: ${r.error}`);
      console.log('');
    });
  }

  // Error accounts
  if (errors.length > 0) {
    console.log('\n' + '=' .repeat(70));
    console.log('\n❌ ACCOUNTS WITH ERRORS\n');

    // Group by error type
    const errorGroups = new Map<string, AccountResult[]>();
    errors.forEach(r => {
      const key = r.error || 'Unknown';
      if (!errorGroups.has(key)) errorGroups.set(key, []);
      errorGroups.get(key)!.push(r);
    });

    for (const [error, accounts] of errorGroups) {
      console.log(`\n📛 ${error} (${accounts.length} accounts):`);
      accounts.slice(0, 10).forEach(r => {
        console.log(`   - ${r.name} (@${r.handle})`);
      });
      if (accounts.length > 10) {
        console.log(`   ... and ${accounts.length - 10} more`);
      }
    }
  }

  // Fast accounts stats
  if (ok.length > 0) {
    const fastestAvg = ok.slice(-10).reduce((sum, r) => sum + r.time, 0) / Math.min(10, ok.length);
    console.log('\n' + '=' .repeat(70));
    console.log(`\n🚀 Fastest 10 accounts average: ${Math.round(fastestAvg)}ms`);
  }
}

main().catch(console.error);
