import 'server-only';

export interface DatabaseEnvironment {
  connectionString: string;
  maxConnections: number;
  ssl?: false | { rejectUnauthorized: boolean };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function hasDatabaseConfiguration(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function hasOpenAIConfiguration(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function databaseEnvironment(): DatabaseEnvironment {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }

  const sslMode = process.env.DATABASE_SSL?.trim().toLowerCase();
  const ssl =
    sslMode === 'disable'
      ? false
      : sslMode === 'require'
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined;

  return {
    connectionString,
    maxConnections: positiveInteger(process.env.DATABASE_POOL_MAX, 3),
    ...(ssl === undefined ? {} : { ssl }),
  };
}
