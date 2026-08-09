import type { PlayState, Work } from './types';

export interface TourProbeEntry {
  role: 'user' | 'assistant';
  text: string;
  gains?: string[];
}

export interface TourProbeDemo {
  log: TourProbeEntry[];
  /** 투어에서 사용자가 새 질문을 입력했을 때 돌려주는 고정 응답 */
  reply: string;
}

/** DB의 tour_documents.content에 저장하는 JSON 문서. */
export interface TourDocument {
  work: Work;
  sceneState: PlayState;
  probeState: PlayState;
  probeDemo: TourProbeDemo;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isWork(value: unknown): value is Work {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (value.rating === 'all' || value.rating === 'adult') &&
    isObject(value.stats) &&
    Array.isArray(value.characters) &&
    Array.isArray(value.episodes)
  );
}

function isPlayState(value: unknown): value is PlayState {
  if (!isObject(value)) return false;
  return (
    typeof value.workId === 'string' &&
    Number.isInteger(value.episodeIndex) &&
    typeof value.nodeId === 'string' &&
    isObject(value.stats) &&
    Array.isArray(value.flags) &&
    Array.isArray(value.items) &&
    Array.isArray(value.revealed) &&
    Array.isArray(value.log) &&
    Array.isArray(value.endings)
  );
}

function isProbeDemo(value: unknown): value is TourProbeDemo {
  if (!isObject(value) || typeof value.reply !== 'string' || !Array.isArray(value.log)) return false;
  return value.log.every(
    (entry) =>
      isObject(entry) &&
      (entry.role === 'user' || entry.role === 'assistant') &&
      typeof entry.text === 'string' &&
      (entry.gains === undefined ||
        (Array.isArray(entry.gains) && entry.gains.every((gain) => typeof gain === 'string'))),
  );
}

export function isTourDocument(value: unknown): value is TourDocument {
  if (!isObject(value)) return false;
  if (!isWork(value.work) || !isPlayState(value.sceneState) || !isPlayState(value.probeState)) {
    return false;
  }
  return (
    value.sceneState.workId === value.work.id &&
    value.probeState.workId === value.work.id &&
    isProbeDemo(value.probeDemo)
  );
}
