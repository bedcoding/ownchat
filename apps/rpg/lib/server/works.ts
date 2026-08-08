import 'server-only';
import { query } from './db';
import type { Work } from '../types';

interface WorkRow {
  content: Work;
}

export async function listPublishedWorks(): Promise<Work[]> {
  const result = await query<WorkRow>(
    `SELECT content
       FROM works
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST, updated_at DESC`,
  );
  return result.rows.map((row) => row.content);
}
