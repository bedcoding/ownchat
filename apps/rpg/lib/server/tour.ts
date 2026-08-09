import 'server-only';
import { isTourDocument, type TourDocument } from '../tour';
import { query } from './db';
import { databaseSchema, quoteDatabaseIdentifier } from './env';

interface TourRow {
  content: unknown;
  version: number;
}

export interface PublishedTourDocument {
  document: TourDocument;
  revision: number;
}

export async function findPublishedTourDocument(slug = 'default'): Promise<PublishedTourDocument | null> {
  const schema = quoteDatabaseIdentifier(databaseSchema());
  const result = await query<TourRow>(
    `SELECT content, version
       FROM ${schema}.tour_documents
      WHERE slug = $1 AND status = 'published'
      LIMIT 1`,
    [slug],
  );
  const row = result.rows[0];
  if (!row || !isTourDocument(row.content)) return null;
  return { document: row.content, revision: row.version };
}
