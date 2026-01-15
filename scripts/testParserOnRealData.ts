/**
 * Test Parser on Real RSS Data
 * =============================
 * Fetches actual posts from our RSS feeds and runs them through the parser
 * to see how it performs on real-world data.
 *
 * Run with: npx tsx scripts/testParserOnRealData.ts
 */

import { analyzeMessage, formatAnalysisForDisplay } from '../src/lib/messageAnalysis';

// Sample RSS feeds to test against
const TEST_FEEDS = [
  'https://bsky.app/profile/did:plc:mv3wqhupmaql7bulhco5vuqb/rss',  // Euromaidan Press
  'https://bsky.app/profile/did:plc:qkveij62ajwhgg5wwr3wioqr/rss',  // OSINTdefender
  'https://bsky.app/profile/did:plc:sn7kwnbdmj7f2ukdxeh3hhnu/rss',  // Shipwreck
  'https://www.state.gov/rss-feed/press-releases/feed/',  // State Dept
];

async function fetchRSS(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'newsAlert/1.0 RSS Reader',
      },
    });

    if (!response.ok) {
      console.log(`  Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const xml = await response.text();

    // Simple extraction of titles and descriptions
    const items: string[] = [];

    // Match <title> or <description> content
    const titleMatches = xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gs);
    const descMatches = xml.matchAll(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/gs);

    for (const match of titleMatches) {
      const content = match[1] || match[2];
      if (content && content.length > 20 && !content.includes('Bluesky') && !content.includes('RSS')) {
        items.push(content.trim());
      }
    }

    for (const match of descMatches) {
      const content = match[1] || match[2];
      if (content && content.length > 30) {
        items.push(content.trim());
      }
    }

    return items.slice(0, 10); // Limit to 10 per feed
  } catch (error) {
    console.log(`  Error fetching ${url}:`, error);
    return [];
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('PARSER TEST ON REAL RSS DATA');
  console.log('='.repeat(80) + '\n');

  const allResults: { text: string; analysis: ReturnType<typeof analyzeMessage>; display: ReturnType<typeof formatAnalysisForDisplay> }[] = [];

  for (const feedUrl of TEST_FEEDS) {
    console.log(`Fetching: ${feedUrl.substring(0, 60)}...`);
    const items = await fetchRSS(feedUrl);
    console.log(`  Found ${items.length} items\n`);

    for (const item of items) {
      const analysis = analyzeMessage(item);
      const display = formatAnalysisForDisplay(analysis);
      allResults.push({ text: item, analysis, display });
    }
  }

  // Display results grouped by content type
  console.log('\n' + '='.repeat(80));
  console.log('RESULTS BY CONTENT TYPE');
  console.log('='.repeat(80) + '\n');

  const byContentType: Record<string, typeof allResults> = {};
  for (const result of allResults) {
    const type = result.analysis.contentType.type;
    if (!byContentType[type]) byContentType[type] = [];
    byContentType[type].push(result);
  }

  for (const [type, results] of Object.entries(byContentType)) {
    console.log(`\n--- ${type.toUpperCase()} (${results.length}) ---\n`);

    for (const result of results.slice(0, 5)) { // Show max 5 per category
      const truncated = result.text.length > 100 ? result.text.substring(0, 100) + '...' : result.text;
      console.log(`"${truncated}"`);
      console.log(`  Type: ${result.analysis.contentType.type} (${result.analysis.contentType.confidence.toFixed(2)})`);
      console.log(`  Verification: ${result.analysis.verification.level}`);
      console.log(`  Provenance: ${result.analysis.provenance.type}`);
      if (result.analysis.provenance.citedSources.length > 0) {
        console.log(`  Cited: ${result.analysis.provenance.citedSources.join(', ')}`);
      }
      console.log(`  Display: "${result.display.primary}" | "${result.display.secondary || 'none'}"`);
      console.log('');
    }
  }

  // Summary stats
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));

  const contentTypeCounts: Record<string, number> = {};
  const verificationCounts: Record<string, number> = {};
  const provenanceCounts: Record<string, number> = {};

  for (const result of allResults) {
    contentTypeCounts[result.analysis.contentType.type] = (contentTypeCounts[result.analysis.contentType.type] || 0) + 1;
    verificationCounts[result.analysis.verification.level] = (verificationCounts[result.analysis.verification.level] || 0) + 1;
    provenanceCounts[result.analysis.provenance.type] = (provenanceCounts[result.analysis.provenance.type] || 0) + 1;
  }

  console.log(`\nTotal posts analyzed: ${allResults.length}`);
  console.log('\nContent Type Distribution:');
  for (const [type, count] of Object.entries(contentTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} (${(count/allResults.length*100).toFixed(1)}%)`);
  }

  console.log('\nVerification Distribution:');
  for (const [level, count] of Object.entries(verificationCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${level}: ${count} (${(count/allResults.length*100).toFixed(1)}%)`);
  }

  console.log('\nProvenance Distribution:');
  for (const [type, count] of Object.entries(provenanceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} (${(count/allResults.length*100).toFixed(1)}%)`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main();
