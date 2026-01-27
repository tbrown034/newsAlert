#!/usr/bin/env node
/**
 * Filter bluecrawler accounts for news/OSINT relevance
 * and verify their activity levels
 */

const fs = require('fs');

// Load scraped data
const accounts = JSON.parse(fs.readFileSync('bluecrawler-top1000.json', 'utf8'));

// Keywords that indicate news/OSINT relevance
const RELEVANT_KEYWORDS = [
  // News organizations
  'news', 'times', 'post', 'guardian', 'bbc', 'cnn', 'npr', 'pbs',
  'reuters', 'associated press', 'ap ', 'politico', 'axios', 'bloomberg',
  'propublica', 'intercept', 'atlantic', 'vox', 'hill', 'daily',
  // Journalists/Reporters
  'journalist', 'reporter', 'correspondent', 'anchor', 'host',
  // OSINT/Security/Defense
  'osint', 'intelligence', 'security', 'defense', 'military', 'analyst',
  'foreign policy', 'geopolitics', 'conflict', 'war',
  // Politics/Government
  'senator', 'congress', 'rep ', 'gov', 'white house', 'pentagon',
  'state dept', 'diplomat',
  // Think tanks
  'brookings', 'csis', 'cfr', 'rand', 'atlantic council',
  // Specific relevant topics
  'ukraine', 'russia', 'china', 'taiwan', 'israel', 'gaza', 'middle east',
  'breaking', 'investigative', 'exclusive',
];

// Handles that are definitely news/OSINT (manual override)
const DEFINITELY_RELEVANT = new Set([
  'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'cnn.com', 'npr.org',
  'bbc.com', 'bbcnews.bsky.social', 'bbcnewsnight.bsky.social',
  'reuters.com', 'apnews.com', 'politico.com', 'axios.com', 'bloomberg.com',
  'propublica.org', 'theintercept.com', 'motherjones.com', 'theatlantic.com',
  'thedailyshow.com', 'talkingpointsmemo.com',
  'atrupar.com', 'ronfilipkowski.bsky.social', 'mehdirhasan.bsky.social',
  'chrislhayes.bsky.social', 'maddow.bsky.social', 'katiephang.bsky.social',
  'joycewhitevance.bsky.social', 'marcelias.bsky.social',
  'hcrichardson.bsky.social', 'mollyjongfast.bsky.social',
  'briantylercohen.bsky.social', 'bencollins.bsky.social',
  'adamkinzinger.substack.com', 'gtconway.bsky.social',
  'kylegriffin1.bsky.social', 'davidcorn.bsky.social',
  'acyn.bsky.social', 'jamellebouie.net',
  // Official government accounts
  'sanders.senate.gov', 'crockett.house.gov', 'barackobama.bsky.social',
  'petebuttigieg.bsky.social', 'whitehouse.senate.gov',
  // Known OSINT/researchers
  'katestarbird.bsky.social', 'socialistdogmom.bsky.social',
  'markzaidesq.bsky.social', 'elonjet.net',
  // UK news
  'privateeyenews.bsky.social', 'newsagents.bsky.social',
]);

// Handles to exclude (celebrities, entertainment, satire, etc.)
const EXCLUDE = new Set([
  'bsky.app', 'theonion.com', 'thegodpodcast.com', 'dril.bsky.social',
  'stephenking.bsky.social', 'georgetakei.bsky.social', 'markhamillofficial.bsky.social',
  'pattonoswalt.bsky.social', 'mcuban.bsky.social', 'hankgreen.bsky.social',
  'dieworkwear.bsky.social', 'aoc.bsky.social', // politicians without news focus
]);

function isRelevant(account) {
  // Check manual overrides first
  if (EXCLUDE.has(account.handle)) return false;
  if (DEFINITELY_RELEVANT.has(account.handle)) return true;

  // Check if handle ends with .gov
  if (account.handle.endsWith('.gov')) return true;

  // Check keywords in name
  const name = (account.name || '').toLowerCase();
  for (const keyword of RELEVANT_KEYWORDS) {
    if (name.includes(keyword)) return true;
  }

  // Check if handle contains news org domains
  const handle = account.handle.toLowerCase();
  if (handle.includes('news') || handle.includes('times') ||
      handle.includes('post') || handle.includes('bbc') ||
      handle.includes('cnn') || handle.includes('npr') ||
      handle.includes('pbs') || handle.includes('reuters') ||
      handle.includes('politico')) {
    return true;
  }

  return false;
}

// Filter accounts
const relevant = accounts.filter(isRelevant);

console.log(`Found ${relevant.length} potentially relevant accounts out of ${accounts.length}\n`);

// Save filtered list
fs.writeFileSync('bluecrawler-relevant.json', JSON.stringify(relevant, null, 2));

// Print for review
console.log('=== RELEVANT ACCOUNTS ===\n');
for (const a of relevant) {
  console.log(`${a.rank.toString().padStart(4)}. ${a.handle.padEnd(45)} ${a.followers.toLocaleString().padStart(10)} - ${a.name}`);
}

console.log(`\nSaved ${relevant.length} accounts to bluecrawler-relevant.json`);
