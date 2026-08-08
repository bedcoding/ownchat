import { DEV_WORK } from '@/data/devquest';
import { MYSTERY_WORK } from '@/data/mystery';
import { SAMPLE_WORK } from '@/data/sample';
import { includesWork } from './profile';
import type { Work } from './types';

/**
 * Read-only works shipped with the application.
 *
 * They are the final fallback when PostgreSQL and the browser's last good snapshot
 * are unavailable. Published database rows with the same id take precedence.
 */
export const BUNDLED_WORKS: Work[] = [SAMPLE_WORK, DEV_WORK, MYSTERY_WORK].filter((work) =>
  includesWork(work.id),
);

export function mergeWorks(primary: Work[], fallback: Work[]): Work[] {
  const primaryIds = new Set(primary.map((work) => work.id));
  return [...primary, ...fallback.filter((work) => !primaryIds.has(work.id))];
}
