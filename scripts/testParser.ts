/**
 * Test Script for Message Parser
 * ==============================
 * Fetches real posts from RSS feeds and runs them through the parser
 * to evaluate accuracy.
 *
 * Run with: npx tsx scripts/testParser.ts
 */

import { analyzeMessage, formatAnalysisForDisplay, MessageAnalysis } from '../src/lib/messageAnalysis';

// =============================================================================
// TEST CASES - Real-world examples to validate parser
// =============================================================================

const testCases = [
  // BREAKING
  {
    text: "BREAKING: Explosions reported in Kharkiv, air raid sirens active across eastern regions",
    expected: { contentType: 'breaking', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "🚨 ALERT: Multiple missiles launched toward Tel Aviv, Iron Dome active",
    expected: { contentType: 'breaking', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "JUST IN: Russian forces have entered Avdiivka according to multiple sources",
    expected: { contentType: 'breaking', verification: 'unverified', provenance: 'aggregating' },
  },

  // STATEMENT (official sources)
  {
    text: "Pentagon spokesperson confirms US strikes on Houthi targets in Yemen",
    expected: { contentType: 'statement', verification: 'confirmed', provenance: 'official' },
  },
  {
    text: "IDF announces ground operation in southern Gaza has begun",
    expected: { contentType: 'statement', verification: 'confirmed', provenance: 'official' },
  },
  {
    text: "State Department releases statement condemning attacks on civilian infrastructure",
    expected: { contentType: 'statement', verification: 'confirmed', provenance: 'official' },
  },
  {
    text: "Ministry of Defense says air defenses shot down 15 drones overnight",
    expected: { contentType: 'statement', verification: 'confirmed', provenance: 'official' },
  },

  // REPORTS (citing sources)
  {
    text: "According to Reuters, peace talks have stalled over territorial disputes",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'media' },
  },
  {
    text: "Sources say Ukraine is preparing a new counteroffensive in the south",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "Multiple sources report Iranian airspace has been closed to commercial flights",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'aggregating' },
  },
  {
    text: "AP reports at least 12 killed in overnight strikes on Odesa",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'media' },
  },

  // ANALYSIS
  {
    text: "Thread: Analysis of satellite imagery shows significant buildup at Russian base 1/12",
    expected: { contentType: 'analysis', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "🧵 Here's why the latest troop movements matter for the eastern front",
    expected: { contentType: 'analysis', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "Assessment: Based on open source data, the attack likely originated from Iranian territory",
    expected: { contentType: 'analysis', verification: 'unverified', provenance: 'original' },
  },

  // RUMOR
  {
    text: "Hearing chatter about possible evacuation orders but cannot confirm yet",
    expected: { contentType: 'rumor', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "Rumors circulating on Telegram about major offensive, take with grain of salt",
    expected: { contentType: 'rumor', verification: 'unverified', provenance: 'aggregating' },
  },
  {
    text: "Unsubstantiated reports of explosions in Tehran, if true would be significant",
    expected: { contentType: 'rumor', verification: 'unverified', provenance: 'original' },
  },

  // VERIFICATION LEVELS
  {
    text: "CONFIRMED: We can independently verify the strikes hit the ammunition depot",
    expected: { contentType: 'general', verification: 'confirmed', provenance: 'original' },
  },
  {
    text: "DEVELOPING: Situation fluid in Rafah, will update as more details emerge",
    expected: { contentType: 'general', verification: 'developing', provenance: 'original' },
  },
  {
    text: "Russia denies any involvement in the drone attack, calls reports misinformation",
    expected: { contentType: 'general', verification: 'denied', provenance: 'official' },
  },

  // PROVENANCE - aggregating
  {
    text: "Per @OSINTdefender, significant drone activity over Crimea tonight",
    expected: { contentType: 'general', verification: 'unverified', provenance: 'aggregating' },
  },
  {
    text: "Via @wartranslated: Russian milbloggers reporting heavy losses in Bakhmut sector",
    expected: { contentType: 'general', verification: 'unverified', provenance: 'aggregating' },
  },
  {
    text: "Multiple Telegram channels reporting power outages across Kyiv",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'aggregating' },
  },

  // MIXED / EDGE CASES
  {
    text: "Fire at Nevinnomyssk Azot in Russia's Stavropol Krai. The factory plays a key role in Russia's production of explosives and solid-fuel components.",
    expected: { contentType: 'general', verification: 'unverified', provenance: 'original' },
  },
  {
    text: "All the signals are that a U.S. attack on Iran is imminent, a Western military official tells Reuters",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'media' },
  },
  {
    text: "Ukrainian forces reportedly advanced 2km near Robotyne according to ISW",
    expected: { contentType: 'report', verification: 'unverified', provenance: 'media' },
  },
  {
    text: "Zelensky: We will not give up a single meter of Ukrainian land",
    expected: { contentType: 'statement', verification: 'confirmed', provenance: 'official' },
  },
];

// =============================================================================
// TEST RUNNER
// =============================================================================

interface TestResult {
  text: string;
  expected: { contentType: string; verification: string; provenance: string };
  actual: MessageAnalysis;
  formatted: ReturnType<typeof formatAnalysisForDisplay>;
  passed: {
    contentType: boolean;
    verification: boolean;
    provenance: boolean;
    overall: boolean;
  };
}

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    const actual = analyzeMessage(testCase.text);
    const formatted = formatAnalysisForDisplay(actual);

    const passed = {
      contentType: actual.contentType.type === testCase.expected.contentType,
      verification: actual.verification.level === testCase.expected.verification,
      provenance: actual.provenance.type === testCase.expected.provenance,
      overall: false,
    };
    passed.overall = passed.contentType && passed.verification && passed.provenance;

    results.push({
      text: testCase.text,
      expected: testCase.expected,
      actual,
      formatted,
      passed,
    });
  }

  return results;
}

function printResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('MESSAGE PARSER TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  let totalPassed = 0;
  let contentTypePassed = 0;
  let verificationPassed = 0;
  let provenancePassed = 0;

  for (const result of results) {
    const statusIcon = result.passed.overall ? '✅' : '❌';

    console.log(`${statusIcon} ${result.text.substring(0, 70)}${result.text.length > 70 ? '...' : ''}`);
    console.log('');

    // Content Type
    const ctIcon = result.passed.contentType ? '✓' : '✗';
    console.log(`   Content Type: ${ctIcon} Expected: ${result.expected.contentType.padEnd(10)} | Got: ${result.actual.contentType.type.padEnd(10)} (conf: ${result.actual.contentType.confidence.toFixed(2)})`);
    if (result.actual.contentType.matchedPatterns.length > 0) {
      console.log(`                    Matched: "${result.actual.contentType.matchedPatterns.join('", "')}"`);
    }

    // Verification
    const vIcon = result.passed.verification ? '✓' : '✗';
    console.log(`   Verification: ${vIcon} Expected: ${result.expected.verification.padEnd(10)} | Got: ${result.actual.verification.level.padEnd(10)} (conf: ${result.actual.verification.confidence.toFixed(2)})`);
    if (result.actual.verification.matchedPatterns.length > 0) {
      console.log(`                    Matched: "${result.actual.verification.matchedPatterns.join('", "')}"`);
    }

    // Provenance
    const pIcon = result.passed.provenance ? '✓' : '✗';
    console.log(`   Provenance:   ${pIcon} Expected: ${result.expected.provenance.padEnd(10)} | Got: ${result.actual.provenance.type.padEnd(10)} (conf: ${result.actual.provenance.confidence.toFixed(2)})`);
    if (result.actual.provenance.matchedPatterns.length > 0) {
      console.log(`                    Matched: "${result.actual.provenance.matchedPatterns.join('", "')}"`);
    }
    if (result.actual.provenance.citedSources.length > 0) {
      console.log(`                    Cited: ${result.actual.provenance.citedSources.join(', ')}`);
    }

    // Display output
    console.log(`   Display:      Primary: "${result.formatted.primary}" | Secondary: "${result.formatted.secondary || 'none'}"`);

    console.log('');
    console.log('-'.repeat(80));
    console.log('');

    if (result.passed.overall) totalPassed++;
    if (result.passed.contentType) contentTypePassed++;
    if (result.passed.verification) verificationPassed++;
    if (result.passed.provenance) provenancePassed++;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests:      ${results.length}`);
  console.log(`Overall Passed:   ${totalPassed}/${results.length} (${(totalPassed/results.length*100).toFixed(1)}%)`);
  console.log(`Content Type:     ${contentTypePassed}/${results.length} (${(contentTypePassed/results.length*100).toFixed(1)}%)`);
  console.log(`Verification:     ${verificationPassed}/${results.length} (${(verificationPassed/results.length*100).toFixed(1)}%)`);
  console.log(`Provenance:       ${provenancePassed}/${results.length} (${(provenancePassed/results.length*100).toFixed(1)}%)`);
  console.log('='.repeat(80) + '\n');
}

// Run tests
const results = runTests();
printResults(results);
