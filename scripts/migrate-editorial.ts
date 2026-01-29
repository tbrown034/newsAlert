// Migration script to create the editorial_posts table
// Run with: npx tsx scripts/migrate-editorial.ts

import { Pool } from 'pg';

async function migrate() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('Creating editorial_posts table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS editorial_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Content
        title TEXT NOT NULL,
        content TEXT,
        url TEXT,

        -- Type & Display
        post_type TEXT NOT NULL CHECK (post_type IN ('breaking', 'context', 'event', 'pinned')),
        region TEXT,
        pin_order INTEGER DEFAULT 0,

        -- Scheduling
        starts_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,

        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,

        -- Optional
        media_url TEXT,
        internal_note TEXT
      );
    `);

    console.log('Creating indexes...');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_editorial_active
      ON editorial_posts(is_active, post_type);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_editorial_region
      ON editorial_posts(region) WHERE region IS NOT NULL;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_editorial_schedule
      ON editorial_posts(starts_at, expires_at) WHERE starts_at IS NOT NULL;
    `);

    console.log('Migration completed successfully!');

    // Show table info
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'editorial_posts'
      ORDER BY ordinal_position;
    `);

    console.log('\nTable schema:');
    console.table(result.rows);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
