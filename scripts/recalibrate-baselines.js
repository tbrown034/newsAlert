#!/usr/bin/env node
/**
 * Recalibrate postsPerDay baselines for all sources
 * Updates sources-clean.ts with accurate values
 */

const fs = require('fs');
const path = require('path');

async function getActualActivity(handle) {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=100`
    );
    if (!res.ok) return { error: res.status };

    const data = await res.json();
    const posts = data.feed || [];

    if (posts.length < 5) return { postsPerDay: 0 };

    const now = new Date();
    const oldest = new Date(posts[posts.length - 1]?.post?.record?.createdAt);
    const days = Math.max(1, (now - oldest) / (1000 * 60 * 60 * 24));

    // Round to 1 decimal place
    return {
      postsPerDay: Math.round((posts.length / days) * 10) / 10,
      sampleSize: posts.length,
      daysCovered: Math.round(days * 10) / 10
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Extract handles from sources-clean.ts
function getHandles() {
  const sourcesPath = path.join(__dirname, '../src/lib/sources-clean.ts');
  const content = fs.readFileSync(sourcesPath, 'utf8');

  const handles = [];
  const regex = /handle:\s*'@([^']+)'/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    handles.push(match[1]);
  }

  return [...new Set(handles)]; // Dedupe
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 999;

  console.log('=== BASELINE RECALIBRATION ===\n');
  console.log(dryRun ? '🔍 DRY RUN (use --apply to update file)\n' : '📝 APPLYING CHANGES\n');

  let handles = getHandles();
  handles = handles.slice(0, limit);

  console.log(`Checking ${handles.length} sources...\n`);

  const results = {};
  const errors = [];

  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i];
    process.stdout.write(`\r[${i + 1}/${handles.length}] ${handle.padEnd(45)}`);

    const activity = await getActualActivity(handle);

    if (activity.error) {
      errors.push({ handle, error: activity.error });
    } else {
      results[handle] = activity.postsPerDay;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 80));
  }

  console.log('\r' + ' '.repeat(60) + '\n');

  // Show results sorted by activity
  const sorted = Object.entries(results).sort((a, b) => b[1] - a[1]);

  console.log('=== ACTIVITY LEVELS ===\n');
  console.log('HIGH (>20/day):');
  sorted.filter(([_, v]) => v > 20).forEach(([h, v]) =>
    console.log(`  ${v.toString().padStart(6)}/day  ${h}`)
  );

  console.log('\nMEDIUM (5-20/day):');
  sorted.filter(([_, v]) => v >= 5 && v <= 20).forEach(([h, v]) =>
    console.log(`  ${v.toString().padStart(6)}/day  ${h}`)
  );

  console.log('\nLOW (1-5/day):');
  sorted.filter(([_, v]) => v >= 1 && v < 5).forEach(([h, v]) =>
    console.log(`  ${v.toString().padStart(6)}/day  ${h}`)
  );

  console.log('\nMINIMAL (<1/day):');
  sorted.filter(([_, v]) => v < 1).forEach(([h, v]) =>
    console.log(`  ${v.toString().padStart(6)}/day  ${h}`)
  );

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.handle}: ${e.error}`));
  }

  // Update file if not dry run
  if (!dryRun) {
    console.log('\nUpdating sources-clean.ts...');

    const sourcesPath = path.join(__dirname, '../src/lib/sources-clean.ts');
    let content = fs.readFileSync(sourcesPath, 'utf8');

    let updates = 0;
    for (const [handle, postsPerDay] of Object.entries(results)) {
      // Match the postsPerDay line after this handle
      const handleEscaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `(handle:\\s*'@${handleEscaped}'[\\s\\S]*?postsPerDay:\\s*)[\\d.]+`,
        'g'
      );

      const newContent = content.replace(regex, `$1${postsPerDay}`);
      if (newContent !== content) {
        updates++;
        content = newContent;
      }
    }

    fs.writeFileSync(sourcesPath, content);
    console.log(`✓ Updated ${updates} postsPerDay values`);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Checked: ${handles.length}`);
  console.log(`Successful: ${Object.keys(results).length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Avg activity: ${(sorted.reduce((a, [_, v]) => a + v, 0) / sorted.length).toFixed(1)}/day`);

  if (dryRun) {
    console.log('\n💡 Run with --apply to update sources-clean.ts');
  }
}

main().catch(console.error);
