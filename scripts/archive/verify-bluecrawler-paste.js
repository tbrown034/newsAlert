#!/usr/bin/env node
/**
 * Verify accounts from bluecrawler paste
 */

const RELEVANT_ACCOUNTS = [
  // Major news (from paste)
  { handle: 'theguardian.com', name: 'The Guardian', type: 'news' },
  { handle: 'talkingpointsmemo.com', name: 'TPM', type: 'news' },
  { handle: 'privateeyenews.bsky.social', name: 'Private Eye Magazine', type: 'news' },
  { handle: 'newsagents.bsky.social', name: 'The News Agents', type: 'news' },

  // Journalists/Analysts
  { handle: 'davidcorn.bsky.social', name: 'David Corn', type: 'journalist' },
  { handle: 'kylegriffin1.bsky.social', name: 'Kyle Griffin', type: 'journalist' },
  { handle: 'weissmann.substack.com', name: 'Andrew Weissmann', type: 'journalist' },
  { handle: 'hcrichardson.bsky.social', name: 'Heather Cox Richardson', type: 'journalist' },

  // Researchers/Lawyers
  { handle: 'socialistdogmom.bsky.social', name: 'Molly Conger', type: 'researcher' },
  { handle: 'markzaidesq.bsky.social', name: 'Mark Zaid', type: 'researcher' },
  { handle: 'marcelias.bsky.social', name: 'Marc Elias', type: 'researcher' },

  // Political (officials/former)
  { handle: 'adamkinzinger.substack.com', name: 'Adam Kinzinger', type: 'political' },
  { handle: 'whitehouse.senate.gov', name: 'Sen. Sheldon Whitehouse', type: 'official' },
  { handle: 'lincolnproject.us', name: 'Lincoln Project', type: 'political' },

  // Trackers
  { handle: 'elonjet.net', name: 'Elon Jet Tracking', type: 'tracker' },
];

async function verifyAccount(handle) {
  try {
    const profileRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`
    );
    if (!profileRes.ok) return { exists: false, error: `Status ${profileRes.status}` };
    const profile = await profileRes.json();

    const feedRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=30`
    );

    let postsPerDay = 0;
    if (feedRes.ok) {
      const feed = await feedRes.json();
      const posts = feed.feed || [];
      if (posts.length > 1) {
        const now = new Date();
        const oldest = new Date(posts[posts.length - 1]?.post?.record?.createdAt);
        const days = Math.max(1, (now - oldest) / (1000 * 60 * 60 * 24));
        postsPerDay = (posts.length / days).toFixed(1);
      }
    }

    return {
      exists: true,
      displayName: profile.displayName,
      handle: profile.handle,
      followers: profile.followersCount,
      postsPerDay: parseFloat(postsPerDay),
    };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function main() {
  console.log('Verifying accounts from bluecrawler paste...\n');
  console.log('='.repeat(90));

  const verified = [];
  const notFound = [];

  for (const account of RELEVANT_ACCOUNTS) {
    process.stdout.write(`${account.handle.padEnd(40)}`);
    const result = await verifyAccount(account.handle);

    if (result.exists && result.postsPerDay > 0) {
      const tier = result.postsPerDay >= 2 ? 'T1' : result.postsPerDay >= 0.3 ? 'T2' : 'T3';
      console.log(`✓ ${tier} | ${result.postsPerDay.toString().padStart(5)}/day | ${result.followers.toLocaleString().padStart(10)} | ${result.displayName}`);
      verified.push({ ...account, ...result });
    } else if (result.exists) {
      console.log(`○ Dormant (0 posts/day) | ${result.followers?.toLocaleString() || 0}`);
    } else {
      console.log(`✗ Not found (${result.error})`);
      notFound.push(account);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(90));
  console.log(`\nVerified: ${verified.length} | Not found: ${notFound.length}`);

  // Generate TypeScript
  console.log('\n### TypeScript to add to sources-clean.ts ###\n');

  for (const v of verified.sort((a, b) => b.postsPerDay - a.postsPerDay)) {
    const tier = v.postsPerDay >= 2 ? 'T1' : v.postsPerDay >= 0.3 ? 'T2' : 'T3';
    const region = v.type === 'news' ? 'all' : 'us-domestic';
    const sourceTier = v.type === 'official' ? 'official' : v.type === 'news' ? 'reporter' : 'osint';

    console.log(`  {
    id: '${v.handle.replace(/[.@]/g, '-').replace(/-+$/, '')}',
    name: '${v.displayName || v.name}',
    handle: '@${v.handle}',
    platform: 'bluesky',
    tier: '${sourceTier}',
    fetchTier: '${tier}',
    confidence: 80,
    region: '${region}' as WatchpointId,
    feedUrl: 'https://bsky.app/profile/${v.handle}',
    url: 'https://bsky.app/profile/${v.handle}',
    postsPerDay: ${v.postsPerDay},
  },`);
  }
}

main().catch(console.error);
