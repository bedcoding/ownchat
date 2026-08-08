import { config as loadEnvironment } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const MIGRATIONS_DIR = path.join(APP_DIR, 'db', 'migrations');

loadEnvironment({ path: path.join(APP_DIR, '.env.local'), quiet: true });

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is missing. Add it to apps/rpg/.env.local or the process environment.');
  process.exitCode = 1;
} else {
  const sslMode = process.env.DATABASE_SSL?.trim().toLowerCase();
  const ssl =
    sslMode === 'disable'
      ? false
      : sslMode === 'require'
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined;

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: 'ownchat-rpg-migrate',
    ...(ssl === undefined ? {} : { ssl }),
  });

  try {
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort((left, right) => left.localeCompare(right));

    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [1_946_446_721]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const appliedResult = await client.query('SELECT name FROM schema_migrations');
      const applied = new Set(appliedResult.rows.map((row) => row.name));

      for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Applied ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      console.log('Database migrations are up to date.');
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [1_946_446_721]);
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error(`Migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
