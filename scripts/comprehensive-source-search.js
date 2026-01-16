#!/usr/bin/env node
/**
 * Comprehensive search for news/OSINT accounts on Bluesky
 * Searches multiple terms, gets profiles, filters by followers & activity
 */

const SEARCH_TERMS = [
  // News organizations
  'news', 'breaking news', 'reuters', 'associated press',
  'nytimes', 'washington post', 'guardian', 'bbc', 'cnn', 'msnbc',
  'npr', 'pbs', 'politico', 'axios', 'bloomberg', 'financial times',
  // OSINT/Security/Defense
  'osint', 'intelligence', 'defense', 'military', 'security analyst',
  'foreign policy', 'geopolitics', 'national security',
  // Conflict areas
  'ukraine', 'russia', 'middle east', 'israel', 'gaza', 'china', 'taiwan',
  // Journalism
  'journalist', 'reporter', 'correspondent', 'investigative',
  'white house', 'pentagon', 'state department',
  // Think tanks
  'brookings', 'csis', 'atlantic council', 'cfr', 'rand',
];

async function searchActors(query) {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=100`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.actors || [];
  } catch { return []; }
}

async function getProfile(handle) {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

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

function isRelevant(actor) {
  const text = `${actor.displayName || ''} ${actor.description || ''} ${actor.handle}`.toLowerCase();

  const keywords = [
    'news', 'journalist', 'reporter', 'editor', 'correspondent',
    'osint', 'intelligence', 'analyst', 'security', 'defense',
    'geopolitical', 'foreign policy', 'conflict', 'war', 'military',
    'breaking', 'investigative', 'politics', 'washington', 'white house',
    'ukraine', 'russia', 'china', 'middle east', 'israel', 'gaza',
    'nyt', 'wapo', 'bbc', 'cnn', 'reuters', 'associated press', 'npr',
    'guardian', 'times', 'post', 'journal', 'atlantic', 'politico',
    'think tank', 'research', 'policy'
  ];

  return keywords.some(kw => text.includes(kw));
}

async function main() {
  console.log('Searching Bluesky for news/OSINT accounts...\n');

  const handles = new Set();
  const candidates = [];

  // Collect handles from searches
  for (const term of SEARCH_TERMS) {
    process.stdout.write(`Searching "${term}"... `);
    const actors = await searchActors(term);
    let added = 0;
    for (const actor of actors) {
      if (!handles.has(actor.handle)) {
        handles.add(actor.handle);
        if (isRelevant(actor)) {
          candidates.push(actor.handle);
          added++;
        }
      }
    }
    console.log(`${added} relevant`);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nFound ${candidates.length} candidates. Verifying...\n`);

  // Verify each candidate
  const verified = [];
  let i = 0;

  for (const handle of candidates) {
    i++;
    process.stdout.write(`[${i}/${candidates.length}] ${handle.padEnd(40)} `);

    const profile = await getProfile(handle);
    if (!profile || profile.followersCount < 10000) {
      console.log('< 10k followers, skipping');
      await new Promise(r => setTimeout(r, 50));
      continue;
    }

    const activity = await getActivity(handle);
    if (activity < 0.3) {
      console.log(`${profile.followersCount.toLocaleString()} followers, but dormant`);
      await new Promise(r => setTimeout(r, 50));
      continue;
    }

    const tier = activity >= 2 ? 'T1' : activity >= 0.3 ? 'T2' : 'T3';
    console.log(`✓ ${tier} | ${activity}/day | ${profile.followersCount.toLocaleString()} followers`);

    verified.push({
      handle: profile.handle,
      name: profile.displayName,
      followers: profile.followersCount,
      postsPerDay: activity,
      tier,
      description: (profile.description || '').substring(0, 100)
    });

    await new Promise(r => setTimeout(r, 100));
  }

  // Sort by followers
  verified.sort((a, b) => b.followers - a.followers);

  console.log('\n' + '='.repeat(90));
  console.log(`\n### VERIFIED ACCOUNTS (${verified.length}) ###\n`);

  for (const v of verified) {
    console.log(`${v.tier} | @${v.handle.padEnd(40)} | ${v.followers.toLocaleString().padStart(10)} | ${v.postsPerDay}/day | ${v.name}`);
  }

  // Save to JSON
  require('fs').writeFileSync(
    'bluesky-news-accounts.json',
    JSON.stringify(verified, null, 2)
  );
  console.log(`\nSaved to bluesky-news-accounts.json`);
}

main().catch(console.error);
