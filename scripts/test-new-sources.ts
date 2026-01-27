/**
 * Test new Iran/Middle East sources added Jan 2026
 */

// Sample sources to test from each platform
const TEST_SOURCES = {
  bluesky: [
    { name: 'Jon Gambrell', handle: 'jongambrell.bsky.social' },
    { name: 'Ariane Tabatabai', handle: 'atabatabai.bsky.social' },
    { name: 'Washington Institute', handle: 'washinstitute.bsky.social' },
    { name: 'Al-Monitor', handle: 'al-monitor.bsky.social' },
  ],
  telegram: [
    { name: 'Middle East Spectator', url: 'https://t.me/s/Middle_East_Spectator' },
    { name: 'OSINT Defender', url: 'https://t.me/s/OSINTdefender' },
    { name: 'Gulf News', url: 'https://t.me/s/gulfnewsUAE' },
  ],
  reddit: [
    { name: 'r/iran', url: 'https://www.reddit.com/r/iran/hot.json?limit=5' },
    { name: 'r/NewIran', url: 'https://www.reddit.com/r/NewIran/hot.json?limit=5' },
    { name: 'r/SyrianCivilWar', url: 'https://www.reddit.com/r/syriancivilwar/hot.json?limit=5' },
  ],
  youtube: [
    { name: 'i24NEWS', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvHDpsWKADrDia0c99X37vg' },
    { name: 'Iran International', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCat6bC0Wrqq9Bcq7EkH_yQw' },
    { name: 'CaspianReport', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwnKziETDbHJtx78nIkfYug' },
  ],
  mastodon: [
    { name: 'OSINT Aurora', instance: 'mstdn.social', handle: 'osintaurora' },
    { name: 'NetBlocks', instance: 'mastodon.social', handle: 'netblocks' },
  ],
  rss: [
    { name: 'Long War Journal', url: 'https://www.longwarjournal.org/feed' },
    { name: 'War on the Rocks', url: 'https://warontherocks.com/feed/' },
    { name: 'FDD', url: 'https://www.fdd.org/feed/' },
  ],
};

async function testBluesky(sources: typeof TEST_SOURCES.bluesky) {
  console.log('\n📘 Testing Bluesky sources...\n');
  for (const src of sources) {
    try {
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${src.handle}&limit=3`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`  ❌ ${src.name}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const posts = data.feed || [];
      const latest = posts[0]?.post?.record?.createdAt;
      const latestDate = latest ? new Date(latest) : null;
      const daysAgo = latestDate ? Math.round((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24)) : '?';
      console.log(`  ✅ ${src.name}: ${posts.length} posts, latest ${daysAgo} days ago`);
    } catch (e: any) {
      console.log(`  ❌ ${src.name}: ${e.message}`);
    }
  }
}

async function testTelegram(sources: typeof TEST_SOURCES.telegram) {
  console.log('\n📱 Testing Telegram sources...\n');
  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) {
        console.log(`  ❌ ${src.name}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const messageCount = (html.match(/tgme_widget_message_wrap/g) || []).length;
      console.log(`  ✅ ${src.name}: ${messageCount} messages found`);
    } catch (e: any) {
      console.log(`  ❌ ${src.name}: ${e.message}`);
    }
  }
}

async function testReddit(sources: typeof TEST_SOURCES.reddit) {
  console.log('\n🟠 Testing Reddit sources...\n');
  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { 'User-Agent': 'news-alert/1.0' }
      });
      if (!res.ok) {
        console.log(`  ❌ ${src.name}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const posts = data.data?.children || [];
      const topPost = posts[0]?.data;
      console.log(`  ✅ ${src.name}: ${posts.length} posts, top: "${topPost?.title?.slice(0, 50)}..."`);
    } catch (e: any) {
      console.log(`  ❌ ${src.name}: ${e.message}`);
    }
  }
}

async function testYouTube(sources: typeof TEST_SOURCES.youtube) {
  console.log('\n▶️  Testing YouTube sources...\n');
  for (const src of sources) {
    try {
      const res = await fetch(src.url);
      if (!res.ok) {
        console.log(`  ❌ ${src.name}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const entryCount = (xml.match(/<entry>/g) || []).length;
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
      console.log(`  ✅ ${src.name}: ${entryCount} videos`);
    } catch (e: any) {
      console.log(`  ❌ ${src.name}: ${e.message}`);
    }
  }
}

async function testMastodon(sources: typeof TEST_SOURCES.mastodon) {
  console.log('\n🐘 Testing Mastodon sources...\n');
  for (const src of sources) {
    try {
      // First lookup the account ID
      const lookupUrl = `https://${src.instance}/api/v1/accounts/lookup?acct=${src.handle}`;
      const lookupRes = await fetch(lookupUrl);
      if (!lookupRes.ok) {
        console.log(`  ❌ ${src.name}: Account not found`);
        continue;
      }
      const account = await lookupRes.json();

      // Then get statuses
      const statusesUrl = `https://${src.instance}/api/v1/accounts/${account.id}/statuses?limit=5`;
      const statusesRes = await fetch(statusesUrl);
      if (!statusesRes.ok) {
        console.log(`  ❌ ${src.name}: Could not fetch statuses`);
        continue;
      }
      const statuses = await statusesRes.json();
      console.log(`  ✅ ${src.name}: ${statuses.length} posts, ${account.followers_count} followers`);
    } catch (e: any) {
      console.log(`  ❌ ${src.name}: ${e.message}`);
    }
  }
}

async function testRSS(sources: typeof TEST_SOURCES.rss) {
  console.log('\n📰 Testing RSS sources...\n');
  for (const src of sources) {
    try {
      const res = await fetch(src.url);
      if (!res.ok) {
        console.log(`  ❌ ${src.name}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const itemCount = (xml.match(/<item>/g) || []).length;
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
      console.log(`  ✅ ${src.name}: ${itemCount} items`);
    } catch (e: any) {
      console.log(`  ❌ ${src.name}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('🧪 Testing new Iran/Middle East sources\n');
  console.log('='.repeat(60));

  await testBluesky(TEST_SOURCES.bluesky);
  await testTelegram(TEST_SOURCES.telegram);
  await testReddit(TEST_SOURCES.reddit);
  await testYouTube(TEST_SOURCES.youtube);
  await testMastodon(TEST_SOURCES.mastodon);
  await testRSS(TEST_SOURCES.rss);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Testing complete!\n');
}

main().catch(console.error);
