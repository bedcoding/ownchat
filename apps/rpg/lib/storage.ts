import type { PlayState, Work } from './types';
import { BUNDLED_WORKS, mergeWorks } from './bundled';
import { isHostedBuild } from './profile';

/**
 * 저장은 전부 localStorage — 플레이어 런타임에 서버가 없다.
 * 기기 간 이동은 관리자 화면의 JSON 내보내기/가져오기로 한다.
 */

const WORKS_KEY = 'rpg.works.v1';
const HOSTED_WORKS_CACHE_KEY = 'rpg.hosted-works-cache.v1';
const PLAY_KEY = 'rpg.play.v1';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 용량 초과 등 — 저장 실패가 플레이를 막지는 않는다 */
  }
}

/** 관리자가 발행한 작품들. 번들 샘플은 여기 저장되지 않는다 */
export function loadPublished(): Work[] {
  return read<Work[]>(WORKS_KEY, []);
}

export function savePublished(works: Work[]): void {
  write(WORKS_KEY, works);
}

/**
 * 플레이 가능한 작품 = 번들 샘플 + 발행본.
 * 같은 id면 발행본이 이긴다 — 관리자가 샘플을 고쳐 발행할 수 있게.
 */
export function loadPlayableWorks(): Work[] {
  const published = loadPublished();
  return mergeWorks(published, BUNDLED_WORKS);
}

interface HostedWorksResponse {
  works?: unknown;
}

function isWork(value: unknown): value is Work {
  if (!value || typeof value !== 'object') return false;
  const work = value as Partial<Work>;
  return (
    typeof work.id === 'string' &&
    typeof work.title === 'string' &&
    (work.rating === 'all' || work.rating === 'adult') &&
    Boolean(work.stats && typeof work.stats === 'object') &&
    Array.isArray(work.characters) &&
    Array.isArray(work.episodes)
  );
}

/**
 * Public web load order: PostgreSQL API -> last good browser snapshot -> bundled works.
 * Admin/static builds remain entirely local and never call a server route.
 */
export async function loadPlayableWorksForCurrentBuild(): Promise<Work[]> {
  if (!isHostedBuild || typeof window === 'undefined') return loadPlayableWorks();

  try {
    const response = await fetch('/api/works', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`works request failed (${response.status})`);

    const payload = (await response.json()) as HostedWorksResponse;
    const works = Array.isArray(payload.works) ? payload.works.filter(isWork) : [];
    if (works.length > 0) {
      write(HOSTED_WORKS_CACHE_KEY, works);
      return works;
    }
  } catch {
    // A public demo must still open when the remote database is unavailable.
  }

  const cached = read<unknown[]>(HOSTED_WORKS_CACHE_KEY, []).filter(isWork);
  return cached.length > 0 ? cached : [...BUNDLED_WORKS];
}

export function findWork(id: string): Work | undefined {
  return loadPlayableWorks().find((w) => w.id === id);
}

export function loadPlay(): PlayState | null {
  return read<PlayState | null>(PLAY_KEY, null);
}

export function savePlay(state: PlayState | null): void {
  write(PLAY_KEY, state);
}
