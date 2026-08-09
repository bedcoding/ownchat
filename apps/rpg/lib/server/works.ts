import 'server-only';
import { query } from './db';
import { databaseSchema, quoteDatabaseIdentifier } from './env';
import type { Work } from '../types';

interface WorkRow {
  content: Work;
}

export async function listPublishedWorks(): Promise<Work[]> {
  const schema = quoteDatabaseIdentifier(databaseSchema());
  const result = await query<WorkRow>(
    `SELECT content
       FROM ${schema}.works
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST, updated_at DESC`,
  );
  return result.rows.map((row) => row.content);
}
