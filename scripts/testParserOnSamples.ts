/**
 * Test Parser on Real Sample Posts
 * =================================
 * Tests the parser against real posts observed in the wild.
 *
 * Run with: npx tsx scripts/testParserOnSamples.ts
 */

import { analyzeMessage, formatAnalysisForDisplay } from '../src/lib/messageAnalysis';

// Real posts from OSINT sources (observed from live feeds)
const REAL_SAMPLES = [
  // From Euromaidan Press
  "Fire at Nevinnomyssk Azot in Russia's Stavropol Krai The factory plays a key role in Russia's production of explosives and solid-fuel components. It supplies materials for explosive compounds used in artillery shells and warheads. It was attacked several times last year. 🎬Supernova+",

  // From Shipwreck
  "All the signals are that a U.S. attack on Iran is imminent, a Western military official tells Reuters Seeing reports of flights diverting near Iran, Tehran may possibly be closed based on some reports from contacts.",

  // Breaking news style
  "BREAKING: Massive explosions reported in Kyiv following air raid alert. Multiple districts affected.",

  "🚨 Air raid alert declared across all of Ukraine. Threat of ballistic missile launches.",

  // Official statements
  "Pentagon: US conducted precision strikes against Iran-backed militia facilities in Syria",

  "Ministry of Defense: Ukrainian air defenses destroyed 28 of 32 Shahed drones overnight",

  "IDF statement: Ground forces have expanded operations in Khan Yunis",

  // Reports citing sources
  "According to ISW, Russian forces have made marginal gains near Avdiivka despite heavy losses",

  "Reuters: At least 15 killed in overnight strikes on Kharkiv residential areas",

  "Multiple sources report significant explosions at Russian military base in Crimea",

  // Analysis/threads
  "🧵 Thread: Analyzing the latest satellite imagery from Sevastopol naval base. Key findings below.",

  "Assessment: Based on flight tracking data, there appears to be unusual military activity over the Black Sea",

  // Rumors/unverified
  "Hearing unconfirmed reports of evacuations in northern Israel. Cannot verify at this time.",

  "Rumors circulating on Telegram about a major Ukrainian offensive. Take with grain of salt until confirmed.",

  // Aggregated/citing others
  "Per @OSINTdefender: Large convoy spotted moving toward Belgorod region",

  "Via @wartranslated: Russian milbloggers complaining about ammunition shortages",

  // Developing situations
  "DEVELOPING: Situation unclear in Rafah. Will update as more information becomes available.",

  // Denials
  "Russia denies any involvement in the Dnipro attack, calls Ukrainian claims 'propaganda'",

  // Confirmed reports
  "CONFIRMED: We have independently verified the strike hit the ammunition depot shown in earlier footage",

  // Direct quotes
  "Zelensky: 'We will defend every meter of Ukrainian territory'",

  "Putin: Russia will respond to any NATO expansion with 'appropriate measures'",

  // Mixed signals
  "Ukrainian officials say Russian assault on Chasiv Yar has been repelled, per Kyiv Independent",

  "Sources tell BBC that ceasefire talks have stalled over prisoner exchange terms",

  // Casualty reports
  "At least 12 civilians killed in Russian strikes on Odesa, according to regional governor",

  // Infrastructure
  "Power outages reported across multiple regions following overnight drone attacks",
];

function main() {
  console.log('\n' + '='.repeat(80));
  console.log('PARSER TEST ON REAL SAMPLE POSTS');
  console.log('='.repeat(80) + '\n');

  const results: { text: string; analysis: ReturnType<typeof analyzeMessage>; display: ReturnType<typeof formatAnalysisForDisplay> }[] = [];

  for (const sample of REAL_SAMPLES) {
    const analysis = analyzeMessage(sample);
    const display = formatAnalysisForDisplay(analysis);
    results.push({ text: sample, analysis, display });
  }

  // Display each result
  for (const result of results) {
    const truncated = result.text.length > 80 ? result.text.substring(0, 80) + '...' : result.text;

    // Color code based on content type
    let typeColor = '';
    switch (result.analysis.contentType.type) {
      case 'breaking': typeColor = '🔴'; break;
      case 'statement': typeColor = '🟢'; break;
      case 'report': typeColor = '🔵'; break;
      case 'analysis': typeColor = '🟣'; break;
      case 'rumor': typeColor = '🟡'; break;
      default: typeColor = '⚪'; break;
    }

    console.log(`${typeColor} "${truncated}"`);
    console.log(`   Content: ${result.analysis.contentType.type.toUpperCase().padEnd(10)} | Verification: ${result.analysis.verification.level.padEnd(11)} | Provenance: ${result.analysis.provenance.type}`);

    // Show matched patterns if any
    const patterns = [
      ...result.analysis.contentType.matchedPatterns.slice(0, 2),
      ...result.analysis.verification.matchedPatterns.slice(0, 1),
      ...result.analysis.provenance.matchedPatterns.slice(0, 1),
    ].filter(p => p && !p.startsWith('['));

    if (patterns.length > 0) {
      console.log(`   Matched: ${patterns.join(', ')}`);
    }

    if (result.analysis.provenance.citedSources.length > 0) {
      console.log(`   Sources: ${result.analysis.provenance.citedSources.join(', ')}`);
    }

    console.log(`   Display: "${result.display.primary}" | "${result.display.secondary || '-'}"`);
    console.log('');
  }

  // Summary statistics
  console.log('='.repeat(80));
  console.log('DISTRIBUTION SUMMARY');
  console.log('='.repeat(80) + '\n');

  const contentTypeCounts: Record<string, number> = {};
  const verificationCounts: Record<string, number> = {};
  const provenanceCounts: Record<string, number> = {};

  for (const result of results) {
    contentTypeCounts[result.analysis.contentType.type] = (contentTypeCounts[result.analysis.contentType.type] || 0) + 1;
    verificationCounts[result.analysis.verification.level] = (verificationCounts[result.analysis.verification.level] || 0) + 1;
    provenanceCounts[result.analysis.provenance.type] = (provenanceCounts[result.analysis.provenance.type] || 0) + 1;
  }

  console.log(`Total: ${results.length} posts\n`);

  console.log('Content Type:');
  for (const [type, count] of Object.entries(contentTypeCounts).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(count / results.length * 30));
    console.log(`  ${type.padEnd(12)} ${bar} ${count} (${(count/results.length*100).toFixed(0)}%)`);
  }

  console.log('\nVerification:');
  for (const [level, count] of Object.entries(verificationCounts).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(count / results.length * 30));
    console.log(`  ${level.padEnd(12)} ${bar} ${count} (${(count/results.length*100).toFixed(0)}%)`);
  }

  console.log('\nProvenance:');
  for (const [type, count] of Object.entries(provenanceCounts).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(count / results.length * 30));
    console.log(`  ${type.padEnd(12)} ${bar} ${count} (${(count/results.length*100).toFixed(0)}%)`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main();
