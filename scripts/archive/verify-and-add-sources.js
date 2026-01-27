#!/usr/bin/env node
/**
 * Verify activity levels and generate TypeScript for sources-clean.ts
 */

const fs = require('fs');

// Load relevant accounts
const accounts = JSON.parse(fs.readFileSync('bluecrawler-relevant.json', 'utf8'));

// Already in sources-clean.ts
const EXISTING = new Set([
  'apnews.com', 'reuters.com', 'motherjones.com',
  'ronfilipkowski.bsky.social', 'katestarbird.bsky.social',
  'jimacosta.bsky.social', 'jenrubin.bsky.social', 'jaketapper.bsky.social',
  'bbcnewsnight.bsky.social',
  // From previous session
  'eliothiggins.bsky.social', 'wartranslated.bsky.social', 'covertshores.bsky.social',
  'rebel44cz.bsky.social', 'vcdgf555.bsky.social', 'thestudyofwar.bsky.social',
  'intelnightowl.bsky.social', 'vanjackson.bsky.social', 'euanmacdonald.bsky.social',
  'revkin.bsky.social', 'crisisgroup.org', 'helenbranswell.bsky.social',
  'caseynewton.bsky.social', 'bellingcat.com', 'tatarigami.bsky.social',
  'geoconfirmed.org', 'malachy.bsky.social', 'yoruk.bsky.social',
  'allsourcenews.bsky.social', 'homelandgov.bsky.social', 'eudiplomacy.bsky.social',
]);

async function getActivity(handle) {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=30`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const posts = data.feed || [];
    if (posts.length < 2) return 0;
    const now = new Date();
    const oldest = new Date(posts[posts.length - 1]?.post?.record?.createdAt);
    const days = Math.max(1, (now - oldest) / (1000 * 60 * 60 * 24));
    return parseFloat((posts.length / days).toFixed(1));
  } catch { return 0; }
}

// Categorize by type
function getSourceType(account) {
  const handle = account.handle.toLowerCase();
  const name = (account.name || '').toLowerCase();

  if (handle.endsWith('.gov')) return { tier: 'official', region: 'us-domestic' };
  if (handle.includes('news') || handle.includes('times') || handle.includes('post') ||
      handle.includes('bbc') || handle.includes('cnn') || handle.includes('npr') ||
      handle.includes('reuters') || handle.includes('politico') || handle.includes('guardian') ||
      name.includes('news') || name.includes('times')) {
    return { tier: 'reporter', region: 'all' };
  }
  if (name.includes('senator') || name.includes('congress') || name.includes('rep.') ||
      name.includes('governor')) {
    return { tier: 'official', region: 'us-domestic' };
  }
  return { tier: 'osint', region: 'us-domestic' };
}

async function main() {
  console.log('Verifying activity levels...\n');

  const toAdd = [];

  for (const account of accounts) {
    if (EXISTING.has(account.handle)) {
      continue;
    }

    process.stdout.write(`${account.handle.padEnd(45)} `);

    const activity = await getActivity(account.handle);

    if (activity >= 0.3) {
      const tier = activity >= 2 ? 'T1' : 'T2';
      console.log(`✓ ${tier} ${activity}/day`);
      toAdd.push({ ...account, postsPerDay: activity, tier });
    } else {
      console.log(`✗ dormant (${activity}/day)`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  // Sort by tier then activity
  toAdd.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'T1' ? -1 : 1;
    return b.postsPerDay - a.postsPerDay;
  });

  console.log(`\n\n=== NEW SOURCES TO ADD: ${toAdd.length} ===\n`);

  // Generate TypeScript
  console.log('// === BLUECRAWLER TOP 1000 (Jan 2026) ===\n');

  const t1 = toAdd.filter(a => a.tier === 'T1');
  const t2 = toAdd.filter(a => a.tier === 'T2');

  console.log(`// T1 Sources (${t1.length})`);
  for (const a of t1) {
    const type = getSourceType(a);
    const id = a.handle.replace(/[.@]/g, '-').replace(/-+$/, '').replace(/-+/g, '-');
    console.log(`  {
    id: '${id}',
    name: '${(a.name || '').replace(/'/g, "\\'")}',
    handle: '@${a.handle}',
    platform: 'bluesky',
    tier: '${type.tier}',
    fetchTier: 'T1',
    confidence: 80,
    region: '${type.region}' as WatchpointId,
    feedUrl: 'https://bsky.app/profile/${a.handle}',
    url: 'https://bsky.app/profile/${a.handle}',
    postsPerDay: ${a.postsPerDay},
  },`);
  }

  console.log(`\n// T2 Sources (${t2.length})`);
  for (const a of t2) {
    const type = getSourceType(a);
    const id = a.handle.replace(/[.@]/g, '-').replace(/-+$/, '').replace(/-+/g, '-');
    console.log(`  {
    id: '${id}',
    name: '${(a.name || '').replace(/'/g, "\\'")}',
    handle: '@${a.handle}',
    platform: 'bluesky',
    tier: '${type.tier}',
    fetchTier: 'T2',
    confidence: 80,
    region: '${type.region}' as WatchpointId,
    feedUrl: 'https://bsky.app/profile/${a.handle}',
    url: 'https://bsky.app/profile/${a.handle}',
    postsPerDay: ${a.postsPerDay},
  },`);
  }

  // Save to file
  fs.writeFileSync('new-sources-to-add.json', JSON.stringify(toAdd, null, 2));
  console.log(`\n\nSaved ${toAdd.length} accounts to new-sources-to-add.json`);
}

main().catch(console.error);
