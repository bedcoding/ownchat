import type { Choice, Episode, StoryNode, Work } from './types';

/** 저작 도구용 헬퍼. 순수 함수 — 편집기 상태를 불변으로 갱신한다. */

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyWork(): Work {
  const entry = newId('n');
  return {
    id: newId('w'),
    title: '새 작품',
    rating: 'all',
    stats: {},
    characters: [],
    episodes: [
      {
        id: newId('ep'),
        index: 1,
        title: '1화',
        entry,
        nodes: [{ id: entry, text: '', choices: [] }],
      },
    ],
  };
}

export function emptyNode(): StoryNode {
  return { id: newId('n'), text: '', choices: [] };
}

export function emptyChoice(next: string): Choice {
  return { label: '', next };
}

export function emptyEpisode(index: number): Episode {
  const entry = newId('n');
  return {
    id: newId('ep'),
    index,
    title: `${index}화`,
    entry,
    nodes: [{ id: entry, text: '', choices: [] }],
  };
}

/** 작품을 통째로 복제한다 (샘플을 출발점으로 삼을 때) */
export function cloneWork(work: Work, title: string): Work {
  const copy = JSON.parse(JSON.stringify(work)) as Work;
  copy.id = newId('w');
  copy.title = title;
  return copy;
}

// ── 콤마 구분 문자열 ↔ 배열 ───────────────────────────────
// 플래그·아이템은 자유 문자열이라 표 형태 UI보다 한 줄 입력이 훨씬 빠르다.

export function parseList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatList(list?: string[]): string {
  return (list ?? []).join(', ');
}

/** 빈 객체·빈 배열을 제거한다 — JSON을 깔끔하게 유지 */
export function prune<T extends Record<string, unknown>>(obj: T): T | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? (out as T) : undefined;
}

// ── 내보내기 / 가져오기 ────────────────────────────────────

export function downloadWork(work: Work): void {
  const blob = new Blob([JSON.stringify(work, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${work.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  work?: Work;
  error?: string;
}

/**
 * JSON을 작품으로 읽어들인다.
 * 기기 간 이동(집↔회사)의 유일한 경로이므로, 깨진 파일에 대해 명확한 메시지를 준다.
 */
export function parseWork(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'JSON 형식이 아닙니다.' };
  }
  const w = data as Partial<Work>;
  if (typeof w?.id !== 'string' || typeof w?.title !== 'string') {
    return { error: 'id 또는 title 이 없습니다. 이 도구가 내보낸 파일인지 확인하세요.' };
  }
  if (!Array.isArray(w.episodes) || w.episodes.length === 0) {
    return { error: 'episodes 가 비어 있습니다.' };
  }
  for (const ep of w.episodes) {
    if (!Array.isArray(ep?.nodes) || typeof ep?.entry !== 'string') {
      return { error: `에피소드 "${ep?.title ?? '?'}" 에 nodes 또는 entry 가 없습니다.` };
    }
  }
  return {
    work: {
      id: w.id,
      title: w.title,
      rating: w.rating === 'adult' ? 'adult' : 'all',
      stats: w.stats ?? {},
      characters: w.characters ?? [],
      episodes: w.episodes,
    },
  };
}
