/**
 * Test tiered summary API
 * Usage: npx tsx --env-file=.env.local scripts/test-tiers.ts
 */

async function testTier(tier: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing tier: ${tier.toUpperCase()}`);
  console.log('='.repeat(50));

  const start = Date.now();
  const res = await fetch(`http://localhost:3000/api/summary?region=europe-russia&hours=6&tier=${tier}`);
  const elapsed = Date.now() - start;

  console.log(`Status: ${res.status}`);
  console.log(`Time: ${elapsed}ms`);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.log(`Error: ${error.error || 'Unknown'}`);
    return;
  }

  const data = await res.json();
  console.log(`Model: ${data.usage?.model || 'unknown'}`);
  console.log(`Tier: ${data.tier}`);
  console.log(`Latency: ${data.usage?.latencyMs}ms`);
  console.log(`Cost: $${data.usage?.costUsd?.toFixed(6) || '?'}`);
  console.log(`\nSummary: ${data.summary?.slice(0, 200)}...`);
}

async function main() {
  // Test quick tier
  await testTier('quick');

  // Test advanced tier
  await testTier('advanced');

  // Test pro tier (will fail without auth)
  await testTier('pro');
}

main().catch(console.error);
