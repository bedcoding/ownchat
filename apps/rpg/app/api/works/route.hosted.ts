import { BUNDLED_WORKS, mergeWorks } from '@/lib/bundled';
import { listPublishedWorks } from '@/lib/server/works';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const published = await listPublishedWorks();
    const works = mergeWorks(published, BUNDLED_WORKS);
    return Response.json(
      { works, source: published.length > 0 ? 'database' : 'bundle' },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch {
    // The browser owns the fallback order (last good snapshot, then bundled works).
    return Response.json(
      { error: 'works_unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
}
