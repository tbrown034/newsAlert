#!/usr/bin/env node
/**
 * Generate TypeScript entries for new sources to add to sources-clean.ts
 */

const fs = require('fs');

const newSources = JSON.parse(fs.readFileSync('new-sources-to-add.json', 'utf8'));

// Already in sources-clean.ts (handles)
const ALREADY_EXISTS = new Set([
  'apnews.com', 'reuters.com', 'motherjones.com',
  'ronfilipkowski.bsky.social', 'katestarbird.bsky.social',
  'jimacosta.bsky.social', 'jenrubin.bsky.social', 'jaketapper.bsky.social',
  'bbcnewsnight.bsky.social',
  'eliothiggins.bsky.social', 'wartranslated.bsky.social', 'covertshores.bsky.social',
  'rebel44cz.bsky.social', 'vcdgf555.bsky.social', 'thestudyofwar.bsky.social',
  'intelnightowl.bsky.social', 'vanjackson.bsky.social', 'euanmacdonald.bsky.social',
  'revkin.bsky.social', 'crisisgroup.org', 'helenbranswell.bsky.social',
  'caseynewton.bsky.social', 'bellingcat.com', 'tatarigami.bsky.social',
  'geoconfirmed.org', 'malachy.bsky.social', 'yoruk.bsky.social',
  'allsourcenews.bsky.social', 'homelandgov.bsky.social', 'eudiplomacy.bsky.social',
  'oalexanderdk.bsky.social', 'michaelkofman.bsky.social', 'elintnews.bsky.social',
  'merip.bsky.social', 'ryanmcbeth.bsky.social', 'chinamediaproject.bsky.social',
  'chinafile.bsky.social', 'ncuscr.bsky.social', 'andreinetto.bsky.social',
  'miweintraub83.bsky.social', 'ianbremmer.com', 'armscontrolwonk.bsky.social',
  'akmentt.bsky.social', 'genmhayden.bsky.social', 'liveuamap.com',
  'christopherjm.ft.com', 'bbcstever.bsky.social', 'ozkaterji.bsky.social',
  'sangernyt.bsky.social', 'charliesavage.bsky.social', 'richardmilne.ft.com',
  'kateconger.com', 'trbrtc.bsky.social', 'julianbarnes.bsky.social',
  'ericlipton.nytimes.com', 'joetidy.bsky.social', 'tomphillips.bsky.social',
  'andykroll.bsky.social', 'heathervogell.bsky.social', 'ioponomarenko.bsky.social',
  'simonallison.bsky.social', 'kashhill.bsky.social', 'atlanticcouncil.bsky.social',
  'tnsr.org', 'kyivinsider.bsky.social', 'unhcr.org', 'juliaioffe.bsky.social',
  'michaeldweiss.bsky.social', 'abcnews.bsky.social', 'pkrugman.bsky.social',
  'asiasociety.org', 'nerizilber.bsky.social', 'joycekaram.bsky.social',
  'mcfaul.bsky.social', 'noaa.gov'
]);

// Categorize source type
function getSourceType(account) {
  const handle = account.handle.toLowerCase();
  const name = (account.name || '').toLowerCase();

  // Government accounts
  if (handle.endsWith('.gov') || handle.includes('.senate.gov') || handle.includes('.house.gov')) {
    return { sourceTier: 'official', region: 'us-domestic' };
  }

  // Major news organizations
  const newsOrgs = [
    'nytimes', 'washingtonpost', 'guardian', 'cnn', 'npr', 'bbc', 'pbs',
    'bloomberg', 'politico', 'atlantic', 'intercept', 'propublica', 'axios',
    'huffpost', 'vox', 'newsweek', 'latimes', 'nbcnews', 'dailybeast',
    'financialtimes', 'bulwark', 'bylinetimes', 'thetimes', 'privateeyenews',
    'newsagents', 'dailybeans', 'contrarian', 'talkingpointsmemo'
  ];

  for (const org of newsOrgs) {
    if (handle.includes(org) || name.includes(org)) {
      return { sourceTier: 'reporter', region: 'all' };
    }
  }

  // Known journalists/commentators
  const journalists = [
    'atrupar', 'hcrichardson', 'jamellebouie', 'bencollins', 'mollyjongfast',
    'gtconway', 'acyn', 'cwarzel', 'chrislhayes', 'kylegriffin', 'davidcorn',
    'joycewhitevance', 'katiephang', 'maddow', 'adamkinzinger', 'mehdirhasan',
    'briantylercohen', 'marcelias', 'brandyzadrozny', 'macfarlanenews',
    'juliadavisnews', 'thedailyshow', 'decodingfoxnews', 'swiftonsecurity'
  ];

  for (const j of journalists) {
    if (handle.includes(j)) {
      return { sourceTier: 'reporter', region: 'us-domestic' };
    }
  }

  // Think tanks and advocacy groups
  if (handle.includes('democracyforward') || handle.includes('lincolnproject')) {
    return { sourceTier: 'osint', region: 'us-domestic' };
  }

  // Default
  return { sourceTier: 'osint', region: 'us-domestic' };
}

// Generate ID from handle
function generateId(handle) {
  return handle
    .replace(/\.bsky\.social$/, '')
    .replace(/\.(com|org|net|gov|us|eu|br)$/, '')
    .replace(/[.@]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Filter out existing sources
const toAdd = newSources.filter(s => !ALREADY_EXISTS.has(s.handle));

console.log(`Adding ${toAdd.length} new sources (filtered ${newSources.length - toAdd.length} duplicates)\n`);

// Separate by fetch tier
const t1Sources = toAdd.filter(s => s.tier === 'T1');
const t2Sources = toAdd.filter(s => s.tier === 'T2');

console.log('// === BLUECRAWLER TOP 1000 (Jan 2026) ===\n');
console.log(`// T1 Sources to add (${t1Sources.length}):\n`);

for (const s of t1Sources) {
  const { sourceTier, region } = getSourceType(s);
  const id = generateId(s.handle);
  const name = (s.name || '').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim();

  console.log(`  {
    id: '${id}',
    name: '${name}',
    handle: '@${s.handle}',
    platform: 'bluesky',
    tier: '${sourceTier}',
    fetchTier: 'T1',
    confidence: 80,
    region: '${region}' as WatchpointId,
    feedUrl: 'https://bsky.app/profile/${s.handle}',
    url: 'https://bsky.app/profile/${s.handle}',
    postsPerDay: ${s.postsPerDay},
  },`);
}

console.log(`\n// T2 Sources to add (${t2Sources.length}):\n`);

for (const s of t2Sources) {
  const { sourceTier, region } = getSourceType(s);
  const id = generateId(s.handle);
  const name = (s.name || '').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim();

  console.log(`  {
    id: '${id}',
    name: '${name}',
    handle: '@${s.handle}',
    platform: 'bluesky',
    tier: '${sourceTier}',
    fetchTier: 'T2',
    confidence: 80,
    region: '${region}' as WatchpointId,
    feedUrl: 'https://bsky.app/profile/${s.handle}',
    url: 'https://bsky.app/profile/${s.handle}',
    postsPerDay: ${s.postsPerDay},
  },`);
}

console.log('\n\n=== SUMMARY ===');
console.log(`T1 to add: ${t1Sources.length}`);
console.log(`T2 to add: ${t2Sources.length}`);
console.log(`Total new: ${toAdd.length}`);
