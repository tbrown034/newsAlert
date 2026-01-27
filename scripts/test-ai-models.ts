/**
 * AI MODEL COMPARISON TEST
 * ========================
 * Tests Sonnet 4 vs Haiku 3.5 for summary generation quality/speed/cost
 *
 * Usage: npx tsx --env-file=.env.local scripts/test-ai-models.ts
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Model configs
const MODELS = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-3-5-haiku-20241022',
} as const;

const PRICING = {
  [MODELS.sonnet]: { input: 3.0, output: 15.0 },
  [MODELS.haiku]: { input: 0.80, output: 4.0 },
};

// Sample posts (realistic test data)
const SAMPLE_POSTS = [
  { id: 1, source: "Reuters", sourceType: "news-org", minutesAgo: 15, title: "Ukraine reports 67 combat clashes with Russian forces in past 24 hours", contentType: "report" },
  { id: 2, source: "Kyiv Independent", sourceType: "news-org", minutesAgo: 32, title: "Air raid alerts across multiple Ukrainian oblasts as Russia launches drone attack", contentType: "alert" },
  { id: 3, source: "ISW", sourceType: "osint", minutesAgo: 45, title: "Russian forces continue offensive operations near Pokrovsk, make marginal gains", contentType: "analysis" },
  { id: 4, source: "Ukrainian General Staff", sourceType: "official", minutesAgo: 60, title: "Enemy lost 1,230 personnel, 12 tanks, 28 armored vehicles in past day", contentType: "official" },
  { id: 5, source: "Liveuamap", sourceType: "osint", minutesAgo: 22, title: "Explosions reported in Kharkiv region, air defense active", contentType: "ground" },
  { id: 6, source: "BBC News", sourceType: "news-org", minutesAgo: 90, title: "Zelensky to meet EU leaders in Brussels to discuss winter energy support", contentType: "diplomatic" },
  { id: 7, source: "DeepState UA", sourceType: "osint", minutesAgo: 40, title: "Geolocated footage shows Ukrainian forces conducting counter-attack near Toretsk", contentType: "verification" },
  { id: 8, source: "TASS", sourceType: "news-org", minutesAgo: 55, title: "Russian Defense Ministry claims destruction of Ukrainian ammo depot in Sumy region", contentType: "claim" },
];

function buildPrompt(posts: typeof SAMPLE_POSTS): string {
  const now = new Date();
  const currentTimeStr = now.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  return `You are a news editor writing a brief situation update for Europe & Russia.

Current time: ${currentTimeStr}
Window: Last 6 hours

<posts>
${JSON.stringify(posts)}
</posts>

Write a concise briefing in JSON:
{
  "overview": "1-2 sentences. What's the overall picture? Are tensions rising, stable, or easing? Give context.",
  "developments": [
    "Specific event + source (e.g., 'Ukraine reported 49 clashes since dawn - Ukrinform')",
    "Another key development + source",
    "Third if significant, otherwise omit"
  ]
}

Rules:
- Overview = big picture assessment, not a list of events
- Developments = 2-3 specific items with sources, each one line
- Reference time naturally (this morning, overnight, since dawn)
- No jargon, no severity labels, no scores`;
}

async function testModel(modelKey: 'sonnet' | 'haiku'): Promise<{
  model: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}> {
  const model = MODELS[modelKey];
  const prompt = buildPrompt(SAMPLE_POSTS);
  const startTime = Date.now();

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const latencyMs = Date.now() - startTime;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  const pricing = PRICING[model];
  const costUsd = (inputTokens * pricing.input / 1_000_000) +
                  (outputTokens * pricing.output / 1_000_000);

  const output = response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    model,
    output,
    inputTokens,
    outputTokens,
    latencyMs,
    costUsd,
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('AI MODEL COMPARISON: Sonnet 4 vs Haiku 3.5');
  console.log('='.repeat(70));
  console.log(`\nTest data: ${SAMPLE_POSTS.length} sample posts about Ukraine/Russia\n`);

  // Test Sonnet
  console.log('-'.repeat(70));
  console.log('TESTING: Claude Sonnet 4');
  console.log('-'.repeat(70));
  const sonnetResult = await testModel('sonnet');
  console.log(`\nLatency: ${sonnetResult.latencyMs}ms`);
  console.log(`Tokens: ${sonnetResult.inputTokens} in / ${sonnetResult.outputTokens} out`);
  console.log(`Cost: $${sonnetResult.costUsd.toFixed(6)}`);
  console.log('\nOutput:');
  console.log(sonnetResult.output);

  console.log('\n');

  // Test Haiku
  console.log('-'.repeat(70));
  console.log('TESTING: Claude Haiku 3.5');
  console.log('-'.repeat(70));
  const haikuResult = await testModel('haiku');
  console.log(`\nLatency: ${haikuResult.latencyMs}ms`);
  console.log(`Tokens: ${haikuResult.inputTokens} in / ${haikuResult.outputTokens} out`);
  console.log(`Cost: $${haikuResult.costUsd.toFixed(6)}`);
  console.log('\nOutput:');
  console.log(haikuResult.output);

  // Summary comparison
  console.log('\n');
  console.log('='.repeat(70));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(70));
  console.log(`
| Metric      | Sonnet 4              | Haiku 3.5             | Difference |
|-------------|----------------------|----------------------|------------|
| Latency     | ${sonnetResult.latencyMs.toString().padEnd(20)}ms | ${haikuResult.latencyMs.toString().padEnd(20)}ms | ${((sonnetResult.latencyMs / haikuResult.latencyMs)).toFixed(1)}x slower |
| Cost        | $${sonnetResult.costUsd.toFixed(6).padEnd(18)} | $${haikuResult.costUsd.toFixed(6).padEnd(18)} | ${(sonnetResult.costUsd / haikuResult.costUsd).toFixed(1)}x more |
| In Tokens   | ${sonnetResult.inputTokens.toString().padEnd(20)} | ${haikuResult.inputTokens.toString().padEnd(20)} | - |
| Out Tokens  | ${sonnetResult.outputTokens.toString().padEnd(20)} | ${haikuResult.outputTokens.toString().padEnd(20)} | - |
`);

  console.log('Quality assessment: Review the outputs above to compare analysis depth.');
}

main().catch(console.error);
