/**
 * Simulate a real cold start to find where time is spent
 */

import { allSources } from '../src/lib/sources';

interface TimingResult {
  phase: string;
  duration: number;
}

const timings: TimingResult[] = [];

function time(phase: string, fn: () => Promise<any> | any): Promise<any> {
  const start = Date.now();
  const result = fn();
  if (result instanceof Promise) {
    return result.then(r => {
      timings.push({ phase, duration: Date.now() - start });
      return r;
    });
  }
  timings.push({ phase, duration: Date.now() - start });
  return Promise.resolve(result);
}

// Simplified fetch function
async function fetchBlueskyFeed(handle: string): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=20`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return [];
    const data = await response.json();
    return data.feed || [];
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

async function main() {
  const blueskySources = allSources.filter(
    s => s.platform === 'bluesky' || s.feedUrl.includes('bsky.app')
  );

  console.log(`\n🔬 Simulating cold start with ${blueskySources.length} Bluesky sources\n`);
  console.log('=' .repeat(70));

  const overallStart = Date.now();
  const allPosts: any[] = [];

  // Phase 1: Fetch all accounts in batches (like the real code)
  const BATCH_SIZE = 50;
  const BATCH_DELAY = 50;

  console.log('\n📡 Phase 1: Fetching from Bluesky API\n');

  for (let i = 0; i < blueskySources.length; i += BATCH_SIZE) {
    const batch = blueskySources.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(blueskySources.length / BATCH_SIZE);

    const batchStart = Date.now();

    const batchResults = await Promise.all(
      batch.map(source => {
        const match = source.feedUrl.match(/bsky\.app\/profile\/([^\/]+)/);
        const handle = match ? match[1] : '';
        return fetchBlueskyFeed(handle);
      })
    );

    const batchDuration = Date.now() - batchStart;
    const postCount = batchResults.reduce((sum, r) => sum + r.length, 0);
    allPosts.push(...batchResults.flat());

    console.log(`  Batch ${batchNum}/${totalBatches}: ${batchDuration}ms (${postCount} posts)`);

    timings.push({ phase: `batch_${batchNum}`, duration: batchDuration });

    if (i + BATCH_SIZE < blueskySources.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const fetchDuration = Date.now() - overallStart;
  console.log(`\n  Total fetch time: ${fetchDuration}ms`);
  console.log(`  Total posts: ${allPosts.length}`);

  // Phase 2: Simulate processing (simplified)
  console.log('\n⚙️  Phase 2: Processing\n');

  const processStart = Date.now();

  // Simulate deduplication
  await time('deduplication', () => {
    const seen = new Set();
    return allPosts.filter(p => {
      const id = p.post?.uri || Math.random();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });

  // Simulate sorting
  await time('sorting', () => {
    return allPosts.sort((a, b) => {
      const aTime = new Date(a.post?.record?.createdAt || 0).getTime();
      const bTime = new Date(b.post?.record?.createdAt || 0).getTime();
      return bTime - aTime;
    });
  });

  const processDuration = Date.now() - processStart;
  console.log(`  Processing time: ${processDuration}ms`);

  // Summary
  const totalDuration = Date.now() - overallStart;

  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 TIMING BREAKDOWN\n');

  // Group batch timings
  const batchTimings = timings.filter(t => t.phase.startsWith('batch_'));
  const avgBatchTime = batchTimings.reduce((s, t) => s + t.duration, 0) / batchTimings.length;
  const maxBatchTime = Math.max(...batchTimings.map(t => t.duration));
  const minBatchTime = Math.min(...batchTimings.map(t => t.duration));

  console.log('Fetch Phase:');
  console.log(`  - Batches: ${batchTimings.length}`);
  console.log(`  - Avg batch time: ${Math.round(avgBatchTime)}ms`);
  console.log(`  - Min batch time: ${minBatchTime}ms`);
  console.log(`  - Max batch time: ${maxBatchTime}ms`);
  console.log(`  - Total fetch: ${fetchDuration}ms`);

  console.log('\nProcessing Phase:');
  timings.filter(t => !t.phase.startsWith('batch_')).forEach(t => {
    console.log(`  - ${t.phase}: ${t.duration}ms`);
  });

  console.log('\n' + '=' .repeat(70));
  console.log(`\n⏱️  TOTAL COLD START TIME: ${totalDuration}ms\n`);

  // Identify slowest batches
  const sortedBatches = [...batchTimings].sort((a, b) => b.duration - a.duration);
  console.log('Slowest batches:');
  sortedBatches.slice(0, 3).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.phase}: ${t.duration}ms`);
  });
}

main().catch(console.error);
