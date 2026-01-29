// Test discovered Bluesky and Mastodon sources
import { XMLParser } from 'fast-xml-parser';

interface TestResult {
  handle: string;
  platform: string;
  region: string;
  status: 'OK' | 'FAIL' | 'SLOW' | 'EMPTY';
  posts?: number;
  latestPost?: string;
  error?: string;
  responseTime?: number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

async function testBlueskyFeed(handle: string, region: string): Promise<TestResult> {
  const url = `https://bsky.app/profile/${handle}/rss`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NewsAlert/1.0' }
    });
    clearTimeout(timeout);

    const responseTime = Date.now() - start;

    if (!res.ok) {
      return { handle, platform: 'bluesky', region, status: 'FAIL', error: `HTTP ${res.status}`, responseTime };
    }

    const text = await res.text();
    const parsed = parser.parse(text);
    const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
    const itemArray = Array.isArray(items) ? items : items ? [items] : [];

    if (itemArray.length === 0) {
      return { handle, platform: 'bluesky', region, status: 'EMPTY', posts: 0, responseTime };
    }

    const latestPost = itemArray[0]?.pubDate || itemArray[0]?.published || 'unknown';

    return {
      handle,
      platform: 'bluesky',
      region,
      status: responseTime > 5000 ? 'SLOW' : 'OK',
      posts: itemArray.length,
      latestPost: new Date(latestPost).toISOString().split('T')[0],
      responseTime
    };
  } catch (e: any) {
    return { handle, platform: 'bluesky', region, status: 'FAIL', error: e.message?.slice(0, 50), responseTime: Date.now() - start };
  }
}

async function testMastodonFeed(handle: string, region: string): Promise<TestResult> {
  // Parse handle format: user@instance
  const parts = handle.replace(/^@/, '').split('@');
  if (parts.length !== 2) {
    return { handle, platform: 'mastodon', region, status: 'FAIL', error: 'Invalid handle format' };
  }
  const [user, instance] = parts;
  const url = `https://${instance}/@${user}.rss`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NewsAlert/1.0' }
    });
    clearTimeout(timeout);

    const responseTime = Date.now() - start;

    if (!res.ok) {
      return { handle, platform: 'mastodon', region, status: 'FAIL', error: `HTTP ${res.status}`, responseTime };
    }

    const text = await res.text();
    const parsed = parser.parse(text);
    const items = parsed?.rss?.channel?.item || [];
    const itemArray = Array.isArray(items) ? items : items ? [items] : [];

    return {
      handle,
      platform: 'mastodon',
      region,
      status: responseTime > 5000 ? 'SLOW' : 'OK',
      posts: itemArray.length,
      latestPost: itemArray[0]?.pubDate ? new Date(itemArray[0].pubDate).toISOString().split('T')[0] : 'unknown',
      responseTime
    };
  } catch (e: any) {
    return { handle, platform: 'mastodon', region, status: 'FAIL', error: e.message?.slice(0, 50), responseTime: Date.now() - start };
  }
}

// Sources to test - prioritized by region
const blueskyTests = [
  // Middle East (Priority 1)
  { handle: 'ruthmichaelson.com', region: 'middle-east' },
  { handle: 'donmacintyre-27.bsky.social', region: 'middle-east' },
  { handle: 'manniefabian.bsky.social', region: 'middle-east' },
  { handle: 'samirasawlani.bsky.social', region: 'middle-east' },

  // Europe-Russia (Priority 2)
  { handle: 'intelcrab.bsky.social', region: 'europe-russia' },
  { handle: 'auroraintel.bsky.social', region: 'europe-russia' },
  { handle: 'vatniksoup.bsky.social', region: 'europe-russia' },
  { handle: 'wartranslated.bsky.social', region: 'europe-russia' },
  { handle: 'defmon3.bsky.social', region: 'europe-russia' },
  { handle: 'coupsure.bsky.social', region: 'europe-russia' },
  { handle: 'chriso-wiki.bsky.social', region: 'europe-russia' },
  { handle: 'shashj.bsky.social', region: 'europe-russia' },
  { handle: 'colborne.bsky.social', region: 'europe-russia' },
  { handle: 'militarynewsua.bsky.social', region: 'europe-russia' },

  // Asia (Priority 3)
  { handle: 'scmp.com', region: 'asia' },
  { handle: '38north.org', region: 'asia' },
  { handle: 'nknewsorg.bsky.social', region: 'asia' },
  { handle: 'chinamediaproject.bsky.social', region: 'asia' },
  { handle: 'bglaser.bsky.social', region: 'asia' },
  { handle: 'armscontrolwonk.bsky.social', region: 'asia' },

  // Global/Defense
  { handle: 'warontherocks.bsky.social', region: 'all' },
  { handle: 'breakingdefense.com', region: 'all' },
  { handle: 'foreignpolicy.com', region: 'all' },
  { handle: 'defenseone.bsky.social', region: 'all' },

  // LATAM
  { handle: 'occrp.org', region: 'latam' },

  // Africa
  { handle: 'larrymadowo.bsky.social', region: 'all' },
  { handle: 'ruthmaclean.bsky.social', region: 'all' },
];

const mastodonTests = [
  { handle: 'netblocks@mastodon.social', region: 'all' },
  { handle: 'Bellingcat@mstdn.social', region: 'all' },
  { handle: 'osinttechnical@mstdn.social', region: 'europe-russia' },
  { handle: 'ProPublica@newsie.social', region: 'us' },
  { handle: 'OCCRP@mastodon.cloud', region: 'all' },
];

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

async function runTests() {
  console.log('Testing discovered sources...\n');
  console.log('='.repeat(100));

  const results: TestResult[] = [];

  // Test Bluesky in batches of 5
  console.log('\nBLUESKY ACCOUNTS\n');
  for (let i = 0; i < blueskyTests.length; i += 5) {
    const batch = blueskyTests.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(t => testBlueskyFeed(t.handle, t.region))
    );
    results.push(...batchResults);

    for (const r of batchResults) {
      const status = r.status === 'OK' ? 'OK  ' : r.status === 'SLOW' ? 'SLOW' : r.status === 'EMPTY' ? 'EMPT' : 'FAIL';
      const info = r.status === 'OK' || r.status === 'SLOW'
        ? `${r.posts} posts, latest: ${r.latestPost}, ${r.responseTime}ms`
        : r.error || 'No posts';
      console.log(`[${status}] @${pad(r.handle, 35)} [${pad(r.region, 12)}] ${info}`);
    }
  }

  // Test Mastodon
  console.log('\nMASTODON ACCOUNTS\n');
  for (const t of mastodonTests) {
    const r = await testMastodonFeed(t.handle, t.region);
    results.push(r);
    const status = r.status === 'OK' ? 'OK  ' : r.status === 'SLOW' ? 'SLOW' : 'FAIL';
    const info = r.status === 'OK' || r.status === 'SLOW'
      ? `${r.posts} posts, latest: ${r.latestPost}, ${r.responseTime}ms`
      : r.error || 'No posts';
    console.log(`[${status}] @${pad(r.handle, 35)} [${pad(r.region, 12)}] ${info}`);
  }

  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('\nSUMMARY\n');
  const ok = results.filter(r => r.status === 'OK').length;
  const slow = results.filter(r => r.status === 'SLOW').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const empty = results.filter(r => r.status === 'EMPTY').length;

  console.log(`Working: ${ok}`);
  console.log(`Slow: ${slow}`);
  console.log(`Empty: ${empty}`);
  console.log(`Failed: ${fail}`);

  console.log('\nREADY TO ADD (OK status):\n');
  results.filter(r => r.status === 'OK').forEach(r => {
    console.log(`  @${r.handle} (${r.platform}, ${r.region})`);
  });

  if (fail > 0) {
    console.log('\nFAILED (do not add):\n');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  @${r.handle}: ${r.error}`);
    });
  }
}

runTests().catch(console.error);
