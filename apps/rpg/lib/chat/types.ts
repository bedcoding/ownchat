import type { ModelId } from './models';

/**
 * `desktop` 과 `bridge` 는 둘 다 "내 PC의 Claude Code를 구독 요금으로 쓴다"는 같은 경로다.
 * 다른 것은 전송 방식뿐이다 — 데스크톱 앱은 IPC, 호스팅 웹은 로컬 HTTP 브리지.
 */
export type ProviderId = 'desktop' | 'bridge' | 'apikey' | 'openai';
/** 사용자가 고르는 값. 'local' 은 실행 환경에 따라 desktop 또는 bridge로 풀린다 */
export type ProviderMode = 'auto' | 'local' | 'apikey' | 'openai';

export interface ChatError {
  message: string;
  hint?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string;
  /**
   * API 키 모드에서 다음 턴에 그대로 돌려보내야 하는 원본 content 블록.
   * thinking 블록은 편집하지 않고 원형 그대로 되돌려줘야 API가 받아준다.
   */
  raw?: unknown[];
  error?: ChatError;
  streaming?: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: ModelId;
  messages: Message[];
  /** 브리지 모드에서 Claude Code 세션을 잇는 id. 모드가 바뀌면 무의미해진다 */
  bridgeSessionId: string | null;
  /** 세션을 만든 전송 경로와 모델. 다른 경로의 세션을 잘못 재개하지 않게 한다. */
  bridgeSessionProvider?: 'desktop' | 'bridge' | null;
  bridgeSessionModel?: ModelId | null;
  /** 공급자를 바꾼 대화는 새 대화로 분리해 보이지 않는 문맥 손실을 막는다. */
  contextProvider?: ProviderId | null;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  mode: ProviderMode;
  bridgeUrl: string;
  bridgeToken: string;
  apiKey: string;
  /** 공개 데모 서버에 접속할 때 쓰는 코드. OpenAI API 키와는 별개다. */
  demoToken: string;
  model: ModelId;
  showThinking: boolean;
}

export type LoginState = 'idle' | 'starting' | 'awaiting_code' | 'finishing' | 'done' | 'error';

export interface LoginSnapshot {
  state: LoginState;
  url: string | null;
  error: string | null;
}

export interface BridgeHealth {
  ok: true;
  name: string;
  version: string;
  protocol: number;
  defaultModel: string;
  webTools: boolean;
  claudeCli: {
    found: boolean;
    version: string | null;
    /** `claude auth status` 결과. 확인하지 못했으면 null */
    loggedIn: boolean | null;
    authMethod: string | null;
  };
  login?: LoginSnapshot;
}

/** 두 공급자가 공통으로 내보내는 스트림 이벤트 */
export type StreamEvent =
  | { type: 'meta'; sessionId?: string | null; model?: string | null }
  | { type: 'delta'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'notice'; message: string }
  | {
      type: 'done';
      sessionId?: string | null;
      raw?: unknown[];
      costUsd?: number | null;
      usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    }
  | { type: 'error'; message: string; hint?: string | null };

export interface SendOptions {
  message: string;
  model: ModelId;
  /** 브리지 모드에서 이어갈 세션 */
  sessionId?: string | null;
  /** API 키 모드에서 그대로 보낼 대화 이력 */
  history: Message[];
  /** RPG 등장인물처럼 서버 기본 역할 대신 적용할 지침. 서버에서 길이를 다시 제한한다. */
  instructions?: string;
  maxOutputTokens?: number;
  signal: AbortSignal;
}
