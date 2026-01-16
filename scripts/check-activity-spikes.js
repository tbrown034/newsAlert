#!/usr/bin/env node
/**
 * Check for unusual posting activity across sources
 * Compares current posting rate to baseline postsPerDay
 */

const fs = require('fs');
const path = require('path');

// Extract sources from the TypeScript file
function loadSources() {
  const sourcesPath = path.join(__dirname, '../src/lib/sources-clean.ts');
  const content = fs.readFileSync(sourcesPath, 'utf8');

  const sources = [];
  // Match source objects with handle and postsPerDay
  const regex = /{\s*id:\s*'([^']+)'[\s\S]*?handle:\s*'@([^']+)'[\s\S]*?fetchTier:\s*'(T[123])'[\s\S]*?postsPerDay:\s*([\d.]+)/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    sources.push({
      id: match[1],
      handle: match[2],
      fetchTier: match[3],
      baselinePostsPerDay: parseFloat(match[4])
    });
  }

  return sources;
}

async function getCurrentActivity(handle) {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=50`
    );
    if (!res.ok) return { error: res.status };

    const data = await res.json();
    const posts = data.feed || [];

    if (posts.length < 2) return { postsPerDay: 0, recentPosts: 0 };

    const now = new Date();

    // Calculate posts in last 24 hours
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const postsLast24h = posts.filter(p =>
      new Date(p.post?.record?.createdAt) > oneDayAgo
    ).length;

    // Calculate posts in last 6 hours (for spike detection)
    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
    const postsLast6h = posts.filter(p =>
      new Date(p.post?.record?.createdAt) > sixHoursAgo
    ).length;

    // Calculate average rate from fetched posts
    const oldest = new Date(posts[posts.length - 1]?.post?.record?.createdAt);
    const days = Math.max(0.1, (now - oldest) / (1000 * 60 * 60 * 24));
    const avgPostsPerDay = posts.length / days;

    // Get most recent post time
    const mostRecent = posts[0]?.post?.record?.createdAt
      ? new Date(posts[0].post.record.createdAt)
      : null;
    const minutesAgo = mostRecent ? Math.round((now - mostRecent) / (1000 * 60)) : null;

    return {
      postsPerDay: parseFloat(avgPostsPerDay.toFixed(1)),
      postsLast24h,
      postsLast6h,
      last6hRate: parseFloat((postsLast6h * 4).toFixed(1)), // Extrapolated to daily rate
      minutesSinceLastPost: minutesAgo,
      totalFetched: posts.length
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const tierFilter = args.find(a => a.startsWith('--tier='))?.split('=')[1];
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 50;
  const spikeThreshold = parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1]) || 2.0;

  console.log('=== ACTIVITY SPIKE DETECTION ===\n');
  console.log(`Spike threshold: ${spikeThreshold}x baseline`);
  console.log(`Checking ${tierFilter ? `T${tierFilter}` : 'all tiers'}...\n`);

  let sources = loadSources();

  if (tierFilter) {
    sources = sources.filter(s => s.fetchTier === `T${tierFilter}`);
  }

  // Prioritize T1 sources
  sources.sort((a, b) => {
    if (a.fetchTier !== b.fetchTier) return a.fetchTier.localeCompare(b.fetchTier);
    return b.baselinePostsPerDay - a.baselinePostsPerDay;
  });

  sources = sources.slice(0, limit);

  console.log(`Checking ${sources.length} sources...\n`);

  const spikes = [];
  const active = [];
  const errors = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    process.stdout.write(`\r[${i + 1}/${sources.length}] ${source.handle.padEnd(40)}`);

    const activity = await getCurrentActivity(source.handle);

    if (activity.error) {
      errors.push({ ...source, error: activity.error });
    } else {
      const result = {
        ...source,
        current: activity.postsPerDay,
        last24h: activity.postsLast24h,
        last6h: activity.postsLast6h,
        last6hRate: activity.last6hRate,
        minutesAgo: activity.minutesSinceLastPost,
        ratio: source.baselinePostsPerDay > 0
          ? (activity.postsPerDay / source.baselinePostsPerDay).toFixed(1)
          : '∞'
      };

      // Check for spikes (current rate significantly higher than baseline)
      if (source.baselinePostsPerDay > 0 &&
          activity.postsPerDay >= source.baselinePostsPerDay * spikeThreshold) {
        spikes.push(result);
      }

      // Track recently active (posted in last hour)
      if (activity.minutesSinceLastPost !== null && activity.minutesSinceLastPost < 60) {
        active.push(result);
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\r' + ' '.repeat(60) + '\r');

  // Report spikes
  if (spikes.length > 0) {
    console.log(`\n🚨 ACTIVITY SPIKES DETECTED (${spikes.length}):\n`);
    spikes.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio));

    for (const s of spikes) {
      console.log(`  ${s.handle}`);
      console.log(`    Baseline: ${s.baselinePostsPerDay}/day → Current: ${s.current}/day (${s.ratio}x)`);
      console.log(`    Last 6h: ${s.last6h} posts (${s.last6hRate}/day rate)`);
      if (s.minutesAgo !== null) {
        console.log(`    Last post: ${s.minutesAgo} minutes ago`);
      }
      console.log('');
    }
  } else {
    console.log('\n✓ No unusual activity spikes detected\n');
  }

  // Report recently active
  if (active.length > 0) {
    console.log(`\n📡 RECENTLY ACTIVE (posted <1hr ago): ${active.length}\n`);
    active.sort((a, b) => a.minutesAgo - b.minutesAgo);

    for (const s of active.slice(0, 20)) {
      const spike = parseFloat(s.ratio) >= spikeThreshold ? ' 🔥' : '';
      console.log(`  ${s.minutesAgo}m ago  ${s.handle.padEnd(35)} ${s.last6h} posts/6h${spike}`);
    }

    if (active.length > 20) {
      console.log(`  ... and ${active.length - 20} more`);
    }
  }

  // Report errors
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) {
      console.log(`  ${e.handle}: ${e.error}`);
    }
  }

  // Summary stats
  console.log('\n=== SUMMARY ===');
  console.log(`Checked: ${sources.length} sources`);
  console.log(`Spikes: ${spikes.length}`);
  console.log(`Active <1hr: ${active.length}`);
  console.log(`Errors: ${errors.length}`);
}

main().catch(console.error);
