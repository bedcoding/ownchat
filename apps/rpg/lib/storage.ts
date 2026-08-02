import { SAMPLE_WORK } from '@/data/sample';
import type { PlayState, Work } from './types';

/**
 * 저장은 전부 localStorage — 플레이어 런타임에 서버가 없다.
 * 기기 간 이동은 관리자 화면의 JSON 내보내기/가져오기로 한다.
 */

const WORKS_KEY = 'rpg.works.v1';
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
  const overridden = new Set(published.map((w) => w.id));
  return [...published, ...(overridden.has(SAMPLE_WORK.id) ? [] : [SAMPLE_WORK])];
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
