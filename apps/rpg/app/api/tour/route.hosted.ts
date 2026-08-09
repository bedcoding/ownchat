import { TOUR_FALLBACK } from '@/data/tour-fallback';
import { findPublishedTourDocument } from '@/lib/server/tour';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(): Promise<Response> {
  try {
    const published = await findPublishedTourDocument();
    if (published) {
      return Response.json(
        { tour: published.document, revision: published.revision, source: 'database' },
        { headers },
      );
    }
  } catch {
    // 심사 화면은 DB 장애 때문에 멈추지 않는다. 아래의 중립 문서로 즉시 폴백한다.
  }

  return Response.json(
    { tour: TOUR_FALLBACK, revision: 0, source: 'fallback' },
    { headers },
  );
}
