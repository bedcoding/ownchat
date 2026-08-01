import { DEFAULT_MODEL } from './models';
import type { Conversation, Settings } from './types';

/**
 * 모든 상태는 브라우저에만 저장한다. API 키·페어링 코드가 서버로 올라가는 경로는
 * 이 앱에 존재하지 않는다 — 서버는 정적 파일만 내려준다.
 *
 * localStorage는 XSS가 나면 그대로 털린다. 그래서 이 앱은 사용자 입력을 innerHTML로
 * 렌더링하지 않고, 외부 스크립트를 하나도 로드하지 않는다.
 */

const SETTINGS_KEY = 'ownchat.settings.v1';
const CONVERSATIONS_KEY = 'ownchat.conversations.v1';

export const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  bridgeUrl: 'http://127.0.0.1:4319',
  bridgeToken: '',
  apiKey: '',
  model: DEFAULT_MODEL,
  showThinking: false,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 등. 저장 실패가 대화 자체를 막지는 않게 조용히 넘어간다.
  }
}

export function loadSettings(): Settings {
  const loaded = read<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  // 이전 버전은 구독 경로를 'bridge'로 저장했다. 이제 실행 환경에 따라 풀리는 'local'이다.
  const mode = (loaded.mode as string) === 'bridge' ? 'local' : loaded.mode;
  return { ...loaded, mode };
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings);
}

export function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  write(CONVERSATIONS_KEY, conversations);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
