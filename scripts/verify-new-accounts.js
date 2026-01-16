#!/usr/bin/env node
/**
 * Verify Bluesky accounts from bluecrawler.com top 1000 list
 * Checks if accounts exist and measures their activity
 */

const ACCOUNTS_TO_VERIFY = [
  // Major news orgs
  { handle: 'apnews.com', name: 'AP News', type: 'news' },
  { handle: 'reuters.bsky.social', name: 'Reuters', type: 'news' },
  { handle: 'motherjones.com', name: 'Mother Jones', type: 'news' },
  { handle: 'politicoeurope.bsky.social', name: 'POLITICO Europe', type: 'news' },
  { handle: 'bbcnewsnight.bsky.social', name: 'BBC Newsnight', type: 'news' },

  // Journalists - political/national security
  { handle: 'jaketapper.bsky.social', name: 'Jake Tapper', type: 'journalist' },
  { handle: 'jimacosta.bsky.social', name: 'Jim Acosta', type: 'journalist' },
  { handle: 'ronfilipkowski.bsky.social', name: 'Ron Filipkowski', type: 'journalist' },
  { handle: 'adamserweratlantic.bsky.social', name: 'Adam Serwer', type: 'journalist' },
  { handle: 'davidcorndc.bsky.social', name: 'David Corn', type: 'journalist' },
  { handle: 'jenrubin.bsky.social', name: 'Jen Rubin', type: 'journalist' },

  // Researchers/analysts
  { handle: 'katestarbird.bsky.social', name: 'Kate Starbird', type: 'researcher' },
  { handle: 'markzaidmsq.bsky.social', name: 'Mark Zaid', type: 'researcher' },
  { handle: 'mollyconger.bsky.social', name: 'Molly Conger', type: 'researcher' },

  // Additional news handles to try
  { handle: 'ap.bsky.social', name: 'AP (alt)', type: 'news' },
  { handle: 'reuters.com', name: 'Reuters (alt)', type: 'news' },
  { handle: 'politico.bsky.social', name: 'POLITICO', type: 'news' },
  { handle: 'theguardian.bsky.social', name: 'The Guardian', type: 'news' },
  { handle: 'wapo.bsky.social', name: 'Washington Post', type: 'news' },
  { handle: 'nytimes.bsky.social', name: 'NY Times', type: 'news' },
];

async function verifyAccount(handle) {
  try {
    // Get profile
    const profileRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`
    );

    if (!profileRes.ok) {
      return { exists: false, error: `Status ${profileRes.status}` };
    }

    const profile = await profileRes.json();

    // Get recent posts to calculate activity
    const feedRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=30`
    );

    let postsPerDay = 0;
    let recentPosts = 0;

    if (feedRes.ok) {
      const feed = await feedRes.json();
      const posts = feed.feed || [];
      recentPosts = posts.length;

      if (posts.length > 1) {
        const now = new Date();
        const oldestPost = new Date(posts[posts.length - 1]?.post?.record?.createdAt);
        const daysDiff = Math.max(1, (now - oldestPost) / (1000 * 60 * 60 * 24));
        postsPerDay = (posts.length / daysDiff).toFixed(1);
      }
    }

    return {
      exists: true,
      did: profile.did,
      displayName: profile.displayName,
      handle: profile.handle,
      followers: profile.followersCount,
      posts: profile.postsCount,
      postsPerDay: parseFloat(postsPerDay),
      recentPosts
    };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function main() {
  console.log('Verifying Bluesky accounts from bluecrawler top 1000...\n');
  console.log('='.repeat(80));

  const verified = [];
  const notFound = [];

  for (const account of ACCOUNTS_TO_VERIFY) {
    process.stdout.write(`Checking ${account.handle.padEnd(40)}`);
    const result = await verifyAccount(account.handle);

    if (result.exists) {
      console.log(`✓ ${result.displayName || account.name} (${result.followers} followers, ${result.postsPerDay}/day)`);
      verified.push({
        ...account,
        ...result
      });
    } else {
      console.log(`✗ Not found (${result.error})`);
      notFound.push(account);
    }

    // Rate limit delay
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n### VERIFIED ACCOUNTS ###\n');

  // Sort by activity
  verified.sort((a, b) => b.postsPerDay - a.postsPerDay);

  for (const v of verified) {
    const tier = v.postsPerDay >= 2 ? 'T1' : v.postsPerDay >= 0.3 ? 'T2' : 'T3';
    console.log(`${tier} | ${v.handle.padEnd(35)} | ${v.postsPerDay.toString().padStart(4)}/day | ${v.followers} followers | ${v.displayName || v.name}`);
  }

  console.log('\n### NOT FOUND ###\n');
  for (const n of notFound) {
    console.log(`   ${n.handle} (${n.name})`);
  }

  console.log('\n### TYPESCRIPT TO ADD ###\n');
  for (const v of verified) {
    const tier = v.postsPerDay >= 2 ? 'T1' : v.postsPerDay >= 0.3 ? 'T2' : 'T3';
    const region = v.type === 'news' ? 'all' : 'us-domestic';
    const sourceType = v.type === 'news' ? 'reporter' : v.type === 'researcher' ? 'osint' : 'reporter';

    console.log(`  {
    id: '${v.handle.replace(/[.@]/g, '-').replace(/-+/g, '-')}',
    name: '${v.displayName || v.name}',
    handle: '@${v.handle}',
    platform: 'bluesky',
    tier: '${sourceType}',
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
