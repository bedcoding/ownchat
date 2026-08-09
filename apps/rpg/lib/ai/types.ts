/**
 * AI 호출 계층의 공통 타입.
 *
 * 이 앱에서 AI 가 도는 자리는 딱 둘이다:
 *   1. 관리자 저작 — 설정 한 줄에서 트리 초안을 뽑는다 (`lib/ai/generate.ts`)
 *   2. 심문 노드 — 플레이어가 목격자에게 자유 질문을 한다 (`lib/ai/probe.ts`)
 *
 * 관리자 빌드는 사용자 기기에서 Claude로 직접 나가고, 공개 웹의 심문은 서버의 OpenAI 키를 쓴다.
 */

/** 어느 경로로 모델에 닿는가 */
export type AiRoute =
  /** 내 PC 의 Claude Code (로컬 브리지 경유). 구독 요금 안에서 돈다 */
  | 'bridge'
  /** 본인 API 키로 api.anthropic.com 직접 호출. 사용량만큼 과금 */
  | 'apikey'
  /** Vercel 서버가 보관한 OpenAI 키. 공개 사용자 심문 전용 */
  | 'openai';

export interface AiTurn {
  role: 'user' | 'assistant';
  text: string;
}

export type AiEvent =
  | { type: 'delta'; text: string }
  /** 브리지 경로의 대화 id — 다음 턴에 넘겨야 맥락이 이어진다 */
  | { type: 'session'; id: string | null }
  | { type: 'error'; message: string; hint?: string | null };

export interface AskOptions {
  prompt: string;
  /** 역할 지침. 브리지 경로에서는 첫 턴 프롬프트 앞에 붙는다 */
  system?: string;
  /** API 키 경로의 멀티턴 이력 (브리지는 sessionId 로 대신한다) */
  history?: AiTurn[];
  /** 브리지 경로에서 이어갈 대화 id */
  sessionId?: string | null;
  maxTokens?: number;
  signal: AbortSignal;
}

export interface AiSettings {
  /** 로컬 브리지 주소 */
  bridgeUrl: string;
  /** 브리지 페어링 코드 */
  bridgeToken: string;
  /** 본인 Anthropic API 키 */
  apiKey: string;
  /** 배포자가 서버 접근 코드를 설정한 경우에만 사용 */
  demoToken: string;
  model: string;
}

/** 브리지 `/health` 응답에서 우리가 보는 부분 */
export interface BridgeHealth {
  name?: string;
  claudeCli?: { found?: boolean; loggedIn?: boolean | null };
}
