// Database connection pool for editorial posts
// Reuses the same DATABASE_URL as Better Auth

import { Pool } from 'pg';

// Singleton pool instance
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5, // Max connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Log pool errors
    pool.on('error', (err) => {
      console.error('[DB Pool] Unexpected error:', err);
    });
  }
  return pool;
}

// Helper for running queries
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// Helper for running single-result queries
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
