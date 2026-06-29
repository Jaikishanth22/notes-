import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const pool = globalForDb.conn ?? new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/notes_sharing',
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = pool;
}

export const db = drizzle(pool, { schema });
export * from './schema';
