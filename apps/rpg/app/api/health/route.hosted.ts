import { checkDatabase } from '@/lib/server/db';
import { hasDatabaseConfiguration, hasOpenAIConfiguration } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const startedAt = Date.now();
  const configured = hasDatabaseConfiguration();
  let connected = false;

  if (configured) {
    try {
      await checkDatabase();
      connected = true;
    } catch {
      connected = false;
    }
  }

  return Response.json(
    {
      ok: connected,
      profile: 'hosted',
      database: { configured, connected },
      openai: { configured: hasOpenAIConfiguration() },
      elapsedMs: Date.now() - startedAt,
    },
    {
      status: connected ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
