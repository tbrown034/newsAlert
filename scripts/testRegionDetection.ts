/**
 * Test Script for Region Detection
 * =================================
 * Tests the region detection logic against various messages.
 *
 * Run with: npx tsx scripts/testRegionDetection.ts
 */

import { detectRegion, getMessageRegion, regionDisplayNames } from '../src/lib/regionDetection';
import { WatchpointId } from '../src/types';

// =============================================================================
// TEST CASES
// =============================================================================

interface TestCase {
  text: string;
  expectedRegion: WatchpointId;
  sourceDefault?: WatchpointId;
  isRegionSpecific?: boolean;
  description?: string;
}

const testCases: TestCase[] = [
  // ===== MIDDLE EAST =====
  {
    text: "BREAKING: Explosions reported in Tel Aviv, Iron Dome activated",
    expectedRegion: 'middle-east',
    description: "Clear Israel reference",
  },
  {
    text: "IDF announces ground operation in Gaza has begun",
    expectedRegion: 'middle-east',
    description: "IDF + Gaza",
  },
  {
    text: "Hamas releases video of hostages in unknown location",
    expectedRegion: 'middle-east',
    description: "Hamas reference",
  },
  {
    text: "Hezbollah launches rockets toward northern Israel from Lebanon",
    expectedRegion: 'middle-east',
    description: "Hezbollah + Lebanon + Israel",
  },
  {
    text: "Iran's IRGC threatens retaliation for strikes in Syria",
    expectedRegion: 'middle-east',
    description: "Iran + IRGC + Syria",
  },
  {
    text: "Houthi rebels claim attack on Red Sea shipping vessel",
    expectedRegion: 'middle-east',
    description: "Houthi + Red Sea",
  },
  {
    text: "Netanyahu: We will continue until total victory",
    expectedRegion: 'middle-east',
    description: "Netanyahu reference",
  },
  {
    text: "Rafah crossing remains closed, humanitarian crisis worsens",
    expectedRegion: 'middle-east',
    description: "Rafah reference",
  },

  // ===== UKRAINE-RUSSIA =====
  {
    text: "BREAKING: Massive drone attack on Kyiv overnight",
    expectedRegion: 'ukraine-russia',
    description: "Kyiv reference",
  },
  {
    text: "Russian forces advance near Bakhmut, ISW reports",
    expectedRegion: 'ukraine-russia',
    description: "Russia + Bakhmut",
  },
  {
    text: "Zelensky: We need more air defense systems from NATO allies",
    expectedRegion: 'ukraine-russia',
    description: "Zelensky reference",
  },
  {
    text: "Putin orders partial mobilization in border regions",
    expectedRegion: 'ukraine-russia',
    description: "Putin + mobilization",
  },
  {
    text: "Explosions reported at Russian airbase in Crimea",
    expectedRegion: 'ukraine-russia',
    description: "Russia + Crimea",
  },
  {
    text: "Ukrainian forces repel assault near Avdiivka",
    expectedRegion: 'ukraine-russia',
    description: "Ukraine + Avdiivka",
  },
  {
    text: "Shahed drones launched from Belarus toward Kharkiv",
    expectedRegion: 'ukraine-russia',
    description: "Shahed + Belarus + Kharkiv",
  },
  {
    text: "Wagner Group forces seen moving toward Belgorod",
    expectedRegion: 'ukraine-russia',
    description: "Wagner + Belgorod",
  },
  {
    text: "Black Sea Fleet vessel reportedly hit by Ukrainian drone",
    expectedRegion: 'ukraine-russia',
    description: "Black Sea + Ukrainian",
  },

  // ===== CHINA-TAIWAN =====
  {
    text: "Chinese military aircraft cross Taiwan Strait median line",
    expectedRegion: 'china-taiwan',
    description: "China + Taiwan Strait",
  },
  {
    text: "PLA conducts live-fire exercises near Taiwan",
    expectedRegion: 'china-taiwan',
    description: "PLA + Taiwan",
  },
  {
    text: "Taipei scrambles jets in response to PLAAF incursions",
    expectedRegion: 'china-taiwan',
    description: "Taipei + PLAAF",
  },
  {
    text: "Xi Jinping: Reunification with Taiwan is inevitable",
    expectedRegion: 'china-taiwan',
    description: "Xi Jinping + Taiwan",
  },
  {
    text: "US carrier group enters South China Sea amid tensions",
    expectedRegion: 'china-taiwan',
    description: "South China Sea",
  },
  {
    text: "Hong Kong protests continue despite security law",
    expectedRegion: 'china-taiwan',
    description: "Hong Kong",
  },
  {
    text: "Beijing denies reports of Xinjiang human rights abuses",
    expectedRegion: 'china-taiwan',
    description: "Beijing + Xinjiang",
  },

  // ===== VENEZUELA =====
  {
    text: "Maduro government arrests opposition leaders in Caracas",
    expectedRegion: 'venezuela',
    description: "Maduro + Caracas",
  },
  {
    text: "Venezuela mobilizes troops near Essequibo border with Guyana",
    expectedRegion: 'venezuela',
    description: "Venezuela + Essequibo + Guyana",
  },
  {
    text: "Opposition leader Guaidó calls for international pressure",
    expectedRegion: 'venezuela',
    description: "Guaidó reference",
  },
  {
    text: "PDVSA reports decline in oil production amid sanctions",
    expectedRegion: 'venezuela',
    description: "PDVSA reference",
  },

  // ===== US DOMESTIC =====
  {
    text: "FBI raids Mar-a-Lago in classified documents probe",
    expectedRegion: 'us-domestic',
    description: "FBI + Mar-a-Lago",
  },
  {
    text: "Biden signs executive order on AI safety",
    expectedRegion: 'us-domestic',
    description: "Biden + executive order",
  },
  {
    text: "Supreme Court issues ruling on gun rights case",
    expectedRegion: 'us-domestic',
    description: "Supreme Court",
  },
  {
    text: "Congress debates new defense spending bill",
    expectedRegion: 'us-domestic',
    description: "Congress reference",
  },
  {
    text: "Trump indicted on federal charges in DC",
    expectedRegion: 'us-domestic',
    description: "Trump + DC",
  },
  {
    text: "DHS issues bulletin on domestic terrorism threats",
    expectedRegion: 'us-domestic',
    description: "DHS + domestic terrorism",
  },
  {
    text: "National Guard deployed to southern border",
    expectedRegion: 'us-domestic',
    description: "National Guard + border",
  },

  // ===== MULTI-REGION / AMBIGUOUS =====
  {
    text: "US strikes Iran-backed militias in Syria and Iraq",
    expectedRegion: 'middle-east',
    sourceDefault: 'all',
    description: "US action in Middle East - should detect ME",
  },
  {
    text: "Pentagon announces new weapons package for Ukraine",
    expectedRegion: 'ukraine-russia',
    sourceDefault: 'all',
    description: "Pentagon + Ukraine - should detect UA",
  },
  {
    text: "State Department condemns human rights abuses in China",
    expectedRegion: 'china-taiwan',
    sourceDefault: 'all',
    description: "State Dept + China - should detect China",
  },

  // ===== FALLBACK CASES =====
  {
    text: "Update: death toll rises to 15 in overnight attack",
    expectedRegion: 'ukraine-russia',
    sourceDefault: 'ukraine-russia',
    description: "Ambiguous - should use source default",
  },
  {
    text: "Breaking: Major explosion reported, details unclear",
    expectedRegion: 'middle-east',
    sourceDefault: 'middle-east',
    description: "Ambiguous - should use source default",
  },
  {
    text: "Air defense systems active, sirens heard",
    expectedRegion: 'all',
    sourceDefault: 'all',
    description: "Ambiguous with 'all' default - should return 'all'",
  },

  // ===== REGION-SPECIFIC SOURCE =====
  {
    text: "Pentagon announces new policy on recruitment",
    expectedRegion: 'ukraine-russia',
    sourceDefault: 'ukraine-russia',
    isRegionSpecific: true,
    description: "Euromaidan-style source - always use source region",
  },
];

// =============================================================================
// TEST RUNNER
// =============================================================================

function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('REGION DETECTION TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const sourceDefault = testCase.sourceDefault || 'all';
    const isRegionSpecific = testCase.isRegionSpecific || false;

    const result = getMessageRegion(testCase.text, sourceDefault, isRegionSpecific);
    const detectionResult = detectRegion(testCase.text, sourceDefault);

    const success = result === testCase.expectedRegion;

    if (success) {
      passed++;
      console.log(`✅ ${testCase.description || ''}`);
    } else {
      failed++;
      console.log(`❌ ${testCase.description || ''}`);
    }

    const truncated = testCase.text.length > 65 ? testCase.text.substring(0, 65) + '...' : testCase.text;
    console.log(`   "${truncated}"`);
    console.log(`   Expected: ${regionDisplayNames[testCase.expectedRegion]} | Got: ${regionDisplayNames[result]}`);

    if (detectionResult.allMatches.length > 0) {
      const topMatch = detectionResult.allMatches[0];
      console.log(`   Detected: ${regionDisplayNames[topMatch.region]} (score: ${topMatch.score}, confidence: ${topMatch.confidence})`);
      console.log(`   Keywords: ${topMatch.matchedKeywords.slice(0, 5).join(', ')}`);
    } else {
      console.log(`   Detected: none (used fallback: ${detectionResult.usedFallback})`);
    }

    console.log('');
  }

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed} (${(passed / testCases.length * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${(failed / testCases.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(80) + '\n');
}

runTests();
