import { askApiKey } from './apikey';
import { askBridge, bridgeUsable, checkBridge } from './bridge';
import { askOpenAI } from './openai';
import { bridgePossible } from './settings';
import { isHostedBuild } from '../profile';
import type { AiEvent, AiRoute, AiSettings, AskOptions, BridgeHealth } from './types';

/**
 * 어느 경로로 모델에 닿을지 정하고, 그 경로로 한 번 물어본다.
 *
 * 구독 경로(브리지)를 먼저 쓴다 — 사용자가 이미 낸 정액 요금 안에서 처리되고,
 * API 키 경로는 사용량만큼 청구되기 때문이다.
 */

export interface Resolution {
  route: AiRoute | null;
  /** 왜 이 경로인지 / 왜 아무 경로도 못 쓰는지 */
  reason: string;
  blocking?: 'need_bridge' | 'need_token' | 'need_login' | 'need_cli' | 'need_key';
}

export function resolveRoute(settings: AiSettings, health: BridgeHealth | null): Resolution {
  if (isHostedBuild) {
    return { route: 'openai', reason: 'OpenAI GPT-5.4 mini · 서버 키는 브라우저에 노출되지 않습니다.' };
  }

  // 폰·태블릿에는 로컬 브리지가 존재할 수 없다. 유일하게 가능한 경로로 곧장 안내한다.
  if (!bridgePossible()) {
    if (settings.apiKey) return { route: 'apikey', reason: '내 API 키로 처리합니다 (사용량만큼 과금).' };
    return { route: null, reason: '이 기기에서는 API 키로만 쓸 수 있습니다.', blocking: 'need_key' };
  }

  if (health && bridgeUsable(health) && settings.bridgeToken) {
    return { route: 'bridge', reason: '내 Claude 구독으로 처리합니다 (추가 과금 없음).' };
  }
  if (settings.apiKey) {
    return {
      route: 'apikey',
      reason: health
        ? '브리지를 쓸 수 없어 API 키로 처리합니다 (사용량만큼 과금).'
        : '브리지가 꺼져 있어 API 키로 처리합니다 (사용량만큼 과금).',
    };
  }

  if (!health) {
    return {
      route: null,
      reason: '브리지가 꺼져 있습니다.',
      blocking: 'need_bridge',
    };
  }
  if (!health.claudeCli?.found) {
    return { route: null, reason: 'Claude Code 가 설치되어 있지 않습니다.', blocking: 'need_cli' };
  }
  if (!settings.bridgeToken) {
    return { route: null, reason: '브리지 페어링 코드가 없습니다.', blocking: 'need_token' };
  }
  return { route: null, reason: 'Claude Code 에 로그인이 필요합니다.', blocking: 'need_login' };
}

export function probeBridge(settings: AiSettings): Promise<BridgeHealth | null> {
  if (isHostedBuild) return Promise.resolve(null);
  if (!bridgePossible()) return Promise.resolve(null);
  return checkBridge(settings.bridgeUrl);
}

export function ask(route: AiRoute, settings: AiSettings, opts: AskOptions): AsyncGenerator<AiEvent> {
  if (route === 'openai') return askOpenAI(settings, opts);
  if (route === 'bridge') {
    return askBridge({
      ...opts,
      baseUrl: settings.bridgeUrl,
      token: settings.bridgeToken,
      model: settings.model,
    });
  }
  return askApiKey({ ...opts, apiKey: settings.apiKey, model: settings.model });
}

export interface AskResult {
  text: string;
  sessionId: string | null;
  error?: { message: string; hint?: string | null };
}

/**
 * 스트림을 끝까지 모아 하나의 결과로 돌려준다.
 *
 * `onDelta` 로 진행 상황을 흘려 볼 수 있다 — 트리 초안 생성은 수십 초가 걸려서
 * 아무 표시가 없으면 멈춘 것처럼 보인다.
 */
export async function askOnce(
  route: AiRoute,
  settings: AiSettings,
  opts: AskOptions,
  onDelta?: (chunk: string, soFar: string) => void,
): Promise<AskResult> {
  let text = '';
  let sessionId: string | null = null;

  for await (const event of ask(route, settings, opts)) {
    if (event.type === 'delta') {
      text += event.text;
      onDelta?.(event.text, text);
    } else if (event.type === 'session') {
      sessionId = event.id;
    } else {
      return { text, sessionId, error: { message: event.message, hint: event.hint } };
    }
  }

  return { text, sessionId };
}
