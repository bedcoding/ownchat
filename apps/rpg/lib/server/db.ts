import 'server-only';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { databaseEnvironment } from './env';

const globalPool = globalThis as typeof globalThis & {
  __ownchatRpgPool?: Pool;
};

function createPool(): Pool {
  const environment = databaseEnvironment();
  const pool = new Pool({
    connectionString: environment.connectionString,
    max: environment.maxConnections,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
    application_name: 'ownchat-rpg',
    ...(environment.ssl === undefined ? {} : { ssl: environment.ssl }),
  });

  // Pool errors may otherwise become uncaught exceptions. Never log credentials.
  pool.on('error', () => console.error('[database] unexpected idle client error'));
  return pool;
}

export function databasePool(): Pool {
  globalPool.__ownchatRpgPool ??= createPool();
  return globalPool.__ownchatRpgPool;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<Row>> {
  return databasePool().query<Row>(text, values);
}

export async function withTransaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase(): Promise<void> {
  await query('SELECT 1');
}
