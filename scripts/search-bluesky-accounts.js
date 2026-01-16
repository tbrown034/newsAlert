#!/usr/bin/env node
/**
 * Search Bluesky for news/OSINT accounts using the public API
 * This bypasses the need to scrape bluecrawler
 */

const SEARCH_TERMS = [
  // News organizations
  'news', 'reuters', 'associated press', 'guardian', 'washington post',
  'bbc', 'cnn', 'msnbc', 'npr', 'pbs', 'abc news', 'cbs news', 'politico',
  // OSINT/Security
  'osint', 'intelligence', 'geopolitical', 'defense', 'military',
  'security', 'conflict', 'ukraine', 'middle east', 'foreign policy',
  // Journalism
  'journalist', 'reporter', 'correspondent', 'investigative',
];

// Known news/OSINT accounts to verify (expanded list)
const KNOWN_ACCOUNTS = [
  // Wire services
  'apnews.com', 'reuters.com', 'afp.com',
  // Major news
  'nytimes.com', 'washingtonpost.com', 'guardian.com', 'bbc.com',
  'npr.org', 'cnn.com', 'msnbc.com', 'cbsnews.com', 'abcnews.com',
  'nbcnews.com', 'pbs.org', 'time.com', 'theatlantic.com',
  'politico.com', 'axios.com', 'thehill.com', 'vox.com',
  // International
  'dw.com', 'france24.com', 'aljazeera.com', 'rt.com',
  'scmp.com', 'japantimes.co.jp', 'haaretz.com',
  // Investigative
  'propublica.org', 'theintercept.com', 'motherjones.com',
  'bellingcat.com', 'icij.org',
  // Foreign policy
  'foreignpolicy.com', 'foreignaffairs.com', 'cfr.org',
  'brookings.edu', 'rand.org', 'csis.org', 'chathamhouse.org',
  // Tech/Cyber
  'wired.com', 'arstechnica.com', 'theverge.com', 'techcrunch.com',
  // Alt handles to try
  'nytimes.bsky.social', 'bbc.bsky.social', 'guardian.bsky.social',
  'cnn.bsky.social', 'reuters.bsky.social', 'npr.bsky.social',
];

async function searchActors(query, limit = 25) {
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.actors || [];
  } catch {
    return [];
  }
}

async function getProfile(handle) {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getActivityLevel(handle) {
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
    return (posts.length / days).toFixed(1);
  } catch {
    return 0;
  }
}

function isRelevant(actor) {
  const name = (actor.displayName || '').toLowerCase();
  const desc = (actor.description || '').toLowerCase();
  const handle = (actor.handle || '').toLowerCase();

  const keywords = [
    'news', 'journalist', 'reporter', 'editor', 'correspondent',
    'osint', 'intelligence', 'analyst', 'security', 'defense',
    'geopolitical', 'foreign policy', 'conflict', 'war', 'military',
    'breaking', 'investigative', 'politics', 'washington', 'white house',
    'ukraine', 'russia', 'china', 'middle east', 'israel', 'gaza',
    'nyt', 'wapo', 'bbc', 'cnn', 'reuters', 'ap ', 'npr', 'pbs',
    'guardian', 'times', 'post', 'journal', 'atlantic', 'politico'
  ];

  const text = `${name} ${desc} ${handle}`;
  return keywords.some(kw => text.includes(kw));
}

async function main() {
  console.log('Searching Bluesky for news/OSINT accounts...\n');

  const found = new Map(); // handle -> actor data

  // First, verify known accounts
  console.log('=== Verifying known news organization handles ===\n');
  for (const handle of KNOWN_ACCOUNTS) {
    const profile = await getProfile(handle);
    if (profile && profile.followersCount > 1000) {
      const activity = await getActivityLevel(handle);
      if (parseFloat(activity) > 0) {
        found.set(handle, { ...profile, postsPerDay: activity });
        console.log(`✓ ${handle.padEnd(35)} ${profile.followersCount.toLocaleString().padStart(10)} followers, ${activity}/day`);
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Then search for more
  console.log('\n=== Searching for relevant accounts ===\n');
  for (const term of SEARCH_TERMS.slice(0, 10)) { // Limit searches
    process.stdout.write(`Searching "${term}"... `);
    const actors = await searchActors(term, 50);
    let count = 0;

    for (const actor of actors) {
      if (found.has(actor.handle)) continue;
      if (actor.followersCount < 10000) continue; // Only accounts with 10k+ followers
      if (!isRelevant(actor)) continue;

      const activity = await getActivityLevel(actor.handle);
      if (parseFloat(activity) >= 0.3) {
        found.set(actor.handle, { ...actor, postsPerDay: activity });
        count++;
      }
      await new Promise(r => setTimeout(r, 50));
    }
    console.log(`found ${count} new`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Output results sorted by followers
  console.log('\n' + '='.repeat(80));
  console.log('\n### ALL FOUND ACCOUNTS (sorted by followers) ###\n');

  const sorted = [...found.values()].sort((a, b) => b.followersCount - a.followersCount);

  for (const actor of sorted) {
    const tier = parseFloat(actor.postsPerDay) >= 2 ? 'T1' :
                 parseFloat(actor.postsPerDay) >= 0.3 ? 'T2' : 'T3';
    console.log(`${tier} | @${actor.handle.padEnd(40)} | ${actor.followersCount.toLocaleString().padStart(10)} | ${actor.postsPerDay}/day | ${actor.displayName || ''}`);
  }

  // Save to file
  const output = sorted.map(a => ({
    handle: a.handle,
    name: a.displayName,
    followers: a.followersCount,
    postsPerDay: parseFloat(a.postsPerDay),
    tier: parseFloat(a.postsPerDay) >= 2 ? 'T1' : parseFloat(a.postsPerDay) >= 0.3 ? 'T2' : 'T3'
  }));

  require('fs').writeFileSync(
    'bluecrawler-accounts.json',
    JSON.stringify(output, null, 2)
  );
  console.log(`\nSaved ${output.length} accounts to bluecrawler-accounts.json`);
}

main().catch(console.error);
