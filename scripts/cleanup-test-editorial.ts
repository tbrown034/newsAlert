// Quick script to delete test editorial posts
// Run with: source .env.local && npx tsx scripts/cleanup-test-editorial.ts

import { Pool } from 'pg';
import { readFileSync } from 'fs';

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Find test editorial posts (by title pattern or specific IDs)
    const testIds = [
      'dee64ebb-2eb8-432e-8993-28a4e9a02ce5', // BREAKING: Test editorial post
      '1eddb01b-fd18-4937-a189-680dc52ff9a5', // Background: Senate DHS funding bill
    ];

    const result = await pool.query(
      `SELECT id, title, created_at FROM editorial_posts WHERE id = ANY($1) OR title LIKE '%Test%' OR title LIKE '%test%'`,
      [testIds]
    );

    console.log(`Found ${result.rows.length} test editorial posts:`);
    for (const row of result.rows) {
      console.log(`  - ${row.id}: ${row.title.slice(0, 50)}...`);
    }

    if (result.rows.length === 0) {
      console.log('No test posts to delete.');
      return;
    }

    // Delete them
    const ids = result.rows.map(r => r.id);
    await pool.query(
      `DELETE FROM editorial_posts WHERE id = ANY($1)`,
      [ids]
    );

    console.log(`\nDeleted ${ids.length} test editorial posts.`);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
