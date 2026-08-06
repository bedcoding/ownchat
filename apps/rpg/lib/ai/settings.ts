import type { AiSettings } from './types';

/**
 * AI 접속 설정. localStorage 에만 있고 이 기기 밖으로 나가지 않는다.
 *
 * 관리자 화면과 심문 노드가 같은 설정을 쓴다 — 관리자가 자기 PC 에서 저작할 때와
 * 플레이어가 심문을 켤 때 필요한 것이 같기 때문이다(모델에 닿는 경로).
 */

const KEY = 'rpg.ai.v1';

/** 브리지 기본 포트는 `packages/bridge` 의 DEFAULT_PORT 와 같아야 한다 */
export const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:4319';

export const DEFAULT_MODEL = 'claude-opus-5';

export function emptySettings(): AiSettings {
  return { bridgeUrl: DEFAULT_BRIDGE_URL, bridgeToken: '', apiKey: '', model: DEFAULT_MODEL };
}

export function loadSettings(): AiSettings {
  if (typeof window === 'undefined') return emptySettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySettings();
    const saved = JSON.parse(raw) as Partial<AiSettings>;
    return {
      bridgeUrl: saved.bridgeUrl?.trim() || DEFAULT_BRIDGE_URL,
      bridgeToken: saved.bridgeToken ?? '',
      apiKey: saved.apiKey ?? '',
      model: saved.model || DEFAULT_MODEL,
    };
  } catch {
    return emptySettings();
  }
}

export function saveSettings(settings: AiSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 저장 실패가 지금 켜 둔 세션을 막지는 않는다 */
  }
}

/**
 * 이 기기에서 로컬 브리지가 있을 수 있는가.
 *
 * 폰·태블릿에서는 127.0.0.1 에 아무것도 없다. 매번 연결 거부 타임아웃을 기다리는 것은
 * 배터리와 시간만 쓰므로 아예 시도하지 않는다 — 그 기기의 유일한 경로는 본인 API 키다.
 */
export function bridgePossible(): boolean {
  if (typeof window === 'undefined') return false;
  const touchOnly =
    window.matchMedia?.('(pointer: coarse)').matches === true &&
    window.matchMedia?.('(hover: hover)').matches !== true;
  return !touchOnly;
}
