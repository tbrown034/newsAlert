/**
 * Test Region Detection on Real Samples
 * ======================================
 * Tests the region detection on real-world posts.
 *
 * Run with: npx tsx scripts/testRegionOnSamples.ts
 */

import { detectRegion, getMessageRegion, regionDisplayNames, regionEmojis } from '../src/lib/regionDetection';
import { WatchpointId } from '../src/types';

// Real posts observed in the wild
const REAL_SAMPLES: { text: string; sourceDefault: WatchpointId; isRegionSpecific?: boolean }[] = [
  // From Euromaidan Press (region-specific: Ukraine)
  {
    text: "Fire at Nevinnomyssk Azot in Russia's Stavropol Krai The factory plays a key role in Russia's production of explosives and solid-fuel components.",
    sourceDefault: 'ukraine-russia',
    isRegionSpecific: true,
  },
  {
    text: "Ukrainian forces reportedly advanced 2km near Robotyne according to ISW",
    sourceDefault: 'ukraine-russia',
    isRegionSpecific: true,
  },

  // From OSINTdefender (multi-region source)
  {
    text: "All the signals are that a U.S. attack on Iran is imminent, a Western military official tells Reuters",
    sourceDefault: 'all',
  },
  {
    text: "Per @wartranslated: Russian milbloggers reporting heavy losses near Bakhmut",
    sourceDefault: 'all',
  },
  {
    text: "BREAKING: Multiple explosions reported in Kharkiv following air raid alert",
    sourceDefault: 'all',
  },
  {
    text: "IDF announces expansion of ground operations in southern Gaza",
    sourceDefault: 'all',
  },

  // From State Department (multi-region official source)
  {
    text: "Secretary Blinken to travel to Israel for humanitarian discussions",
    sourceDefault: 'all',
  },
  {
    text: "State Department condemns Russia's continued aggression against Ukraine",
    sourceDefault: 'all',
  },
  {
    text: "US imposes new sanctions on Chinese technology companies",
    sourceDefault: 'all',
  },

  // From Reuters (multi-region news)
  {
    text: "Reuters: Ceasefire talks between Israel and Hamas have stalled",
    sourceDefault: 'all',
  },
  {
    text: "Putin warns of consequences if NATO continues eastward expansion",
    sourceDefault: 'all',
  },
  {
    text: "Taiwan scrambles jets as Chinese aircraft enter air defense zone",
    sourceDefault: 'all',
  },

  // Ambiguous/follow-up posts
  {
    text: "Update: death toll now at 23, search and rescue ongoing",
    sourceDefault: 'middle-east',  // Would inherit from source
  },
  {
    text: "More details emerging, will update as information comes in",
    sourceDefault: 'ukraine-russia',  // Would inherit from source
  },

  // US domestic
  {
    text: "Biden signs bipartisan infrastructure bill at White House ceremony",
    sourceDefault: 'all',
  },
  {
    text: "FBI investigating threats against election officials in multiple states",
    sourceDefault: 'all',
  },

  // Mixed context posts
  {
    text: "Pentagon announces $2B weapons package for Ukraine including HIMARS ammunition",
    sourceDefault: 'all',
  },
  {
    text: "US Navy carrier group transits South China Sea amid regional tensions",
    sourceDefault: 'all',
  },
  {
    text: "Houthi rebels launch another attack on commercial shipping in Red Sea",
    sourceDefault: 'all',
  },
];

function main() {
  console.log('\n' + '='.repeat(80));
  console.log('REGION DETECTION ON REAL SAMPLES');
  console.log('='.repeat(80) + '\n');

  // Track distribution
  const regionCounts: Record<string, number> = {};

  for (const sample of REAL_SAMPLES) {
    const result = getMessageRegion(
      sample.text,
      sample.sourceDefault,
      sample.isRegionSpecific || false
    );
    const detection = detectRegion(sample.text, sample.sourceDefault);

    regionCounts[result] = (regionCounts[result] || 0) + 1;

    const emoji = regionEmojis[result];
    const truncated = sample.text.length > 70 ? sample.text.substring(0, 70) + '...' : sample.text;

    console.log(`${emoji} ${regionDisplayNames[result]}`);
    console.log(`   "${truncated}"`);
    console.log(`   Source default: ${regionDisplayNames[sample.sourceDefault]}${sample.isRegionSpecific ? ' (region-specific)' : ''}`);

    if (detection.allMatches.length > 0) {
      const top = detection.allMatches[0];
      console.log(`   Detection: ${regionDisplayNames[top.region]} (score: ${top.score}) - ${top.matchedKeywords.slice(0, 3).join(', ')}`);
    } else {
      console.log(`   Detection: none - using source default`);
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(80));
  console.log('DISTRIBUTION');
  console.log('='.repeat(80) + '\n');

  for (const [region, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    const emoji = regionEmojis[region as WatchpointId];
    const bar = '█'.repeat(Math.round(count / REAL_SAMPLES.length * 20));
    console.log(`${emoji} ${regionDisplayNames[region as WatchpointId].padEnd(12)} ${bar} ${count}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main();
