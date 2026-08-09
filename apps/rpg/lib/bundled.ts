import { DEV_WORK } from '@/data/devquest';
import { MYSTERY_WORK } from '@/data/mystery';
import { SAMPLE_WORK } from '@/data/sample';
import { includesWork, isAdminBuild, PROFILE } from './profile';
import type { Work } from './types';

/**
 * Read-only works shipped with the application.
 *
 * They are the final fallback when PostgreSQL and the browser's last good snapshot
 * are unavailable. Published database rows with the same id take precedence.
 */
const bundledCandidates = [
  SAMPLE_WORK,
  MYSTERY_WORK,
  // 개발 조직을 소재로 한 샘플은 로컬 관리자와 명시적인 단일 작품 빌드에서만 싣는다.
  ...(isAdminBuild || PROFILE === DEV_WORK.id ? [DEV_WORK] : []),
];

export const BUNDLED_WORKS: Work[] = bundledCandidates.filter((work) => includesWork(work.id));

export function mergeWorks(primary: Work[], fallback: Work[]): Work[] {
  const primaryIds = new Set(primary.map((work) => work.id));
  return [...primary, ...fallback.filter((work) => !primaryIds.has(work.id))];
}
