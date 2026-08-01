import { subscriptionPossible } from '../capabilities';
import type { BridgeHealth, ProviderId, SendOptions, Settings, StreamEvent } from '../types';
import { streamApiKey } from './apikey';
import { checkBridge, streamBridge } from './bridge';
import { checkDesktop, desktopApi, isDesktop, streamDesktop } from './desktop';

export { checkBridge, startLogin } from './bridge';
export { checkDesktop, desktopApi, isDesktop } from './desktop';

export interface Resolution {
  provider: ProviderId | null;
  /** 왜 이 공급자를 골랐는지 / 왜 아무것도 못 고르는지 */
  reason: string;
  blocking?: 'need_bridge' | 'need_token' | 'need_key' | 'need_login' | 'need_cli';
}

/**
 * 구독 경로의 전송 방식. 데스크톱 앱 안이면 IPC, 아니면 로컬 HTTP 브리지.
 * 브리지는 외부 호출자를 인증해야 하므로 페어링 코드가 필요하고, IPC는 필요 없다.
 */
export function localProviderId(): 'desktop' | 'bridge' {
  return isDesktop() ? 'desktop' : 'bridge';
}

/**
 * 실행 환경에 맞는 방식으로 로컬 Claude Code 상태를 확인한다.
 *
 * 폰·태블릿에서는 아예 시도하지 않는다. 있을 수 없는 127.0.0.1 서버를 주기적으로 찌르는 것은
 * 배터리와 시간만 쓰는 일이다(연결 거부까지 매번 타임아웃을 기다린다).
 */
export function checkLocal(bridgeUrl: string): Promise<BridgeHealth | null> {
  if (isDesktop()) return checkDesktop();
  if (!subscriptionPossible()) return Promise.resolve(null);
  return checkBridge(bridgeUrl);
}

/** `loggedIn`이 null이면 확인하지 못한 것이라 막지 않는다 — 첫 메시지에서 드러난다 */
function localUsable(health: BridgeHealth | null): boolean {
  return Boolean(health && health.claudeCli.found && health.claudeCli.loggedIn !== false);
}

/**
 * 두 경로 중 무엇으로 보낼지 정한다.
 *
 * 구독 경로가 가능하면 그쪽을 먼저 쓴다 — 사용자가 이미 낸 정액 요금 안에서 처리되고,
 * API 키 모드는 대화마다 종량제로 청구되기 때문이다.
 */
export function resolveProvider(settings: Settings, health: BridgeHealth | null): Resolution {
  const local = localProviderId();
  const desktop = local === 'desktop';

  // 폰·태블릿에서는 구독 경로가 존재할 수 없다. 브리지를 띄우라는 안내를 하는 대신
  // 유일하게 가능한 경로(본인 API 키)로 곧장 안내한다.
  if (!subscriptionPossible()) {
    if (settings.apiKey) return { provider: 'apikey', reason: '내 API 키로 처리합니다 (사용량만큼 과금).' };
    return {
      provider: null,
      reason: '이 기기에서는 API 키로만 쓸 수 있습니다.',
      blocking: 'need_key',
    };
  }

  // 데스크톱 앱에는 인증할 외부 호출자가 없으므로 페어링 코드 개념 자체가 없다.
  const tokenOk = desktop || Boolean(settings.bridgeToken);
  const ready = localUsable(health) && tokenOk;
  const subscriptionReason = '내 Claude 구독으로 처리합니다.';

  if (settings.mode === 'local') {
    if (!health) {
      return desktop
        ? { provider: null, reason: 'Claude Code 상태를 확인하지 못했습니다.', blocking: 'need_cli' }
        : { provider: null, reason: '브리지가 꺼져 있습니다.', blocking: 'need_bridge' };
    }
    if (!health.claudeCli.found)
      return {
        provider: null,
        reason: 'Claude Code가 설치되어 있지 않습니다.',
        blocking: 'need_cli',
      };
    if (!tokenOk) return { provider: null, reason: '페어링 코드가 없습니다.', blocking: 'need_token' };
    if (health.claudeCli.loggedIn === false)
      return { provider: null, reason: 'Claude Code에 로그인이 필요합니다.', blocking: 'need_login' };
    return { provider: local, reason: subscriptionReason };
  }

  if (settings.mode === 'apikey') {
    if (!settings.apiKey) return { provider: null, reason: 'API 키가 없습니다.', blocking: 'need_key' };
    return { provider: 'apikey', reason: '내 API 키로 처리합니다 (사용량만큼 과금).' };
  }

  // auto — 구독이 가능하면 구독, 아니면 API 키
  if (ready) return { provider: local, reason: subscriptionReason };
  if (settings.apiKey)
    return {
      provider: 'apikey',
      reason: desktop
        ? 'Claude Code를 못 써서 API 키로 처리합니다 (사용량만큼 과금).'
        : '브리지가 없어 API 키로 처리합니다 (사용량만큼 과금).',
    };
  if (health && !health.claudeCli.found)
    return { provider: null, reason: 'Claude Code가 설치되어 있지 않습니다.', blocking: 'need_cli' };
  // 로그인 버튼도 페어링 코드가 있어야 누를 수 있다(브리지가 토큰을 요구한다). 코드부터 안내한다.
  if (health && !tokenOk)
    return { provider: null, reason: '브리지를 찾았습니다. 페어링 코드를 입력하세요.', blocking: 'need_token' };
  if (health?.claudeCli.loggedIn === false)
    return { provider: null, reason: 'Claude Code에 로그인이 필요합니다.', blocking: 'need_login' };
  return desktop
    ? { provider: null, reason: 'Claude Code를 찾지 못했습니다.', blocking: 'need_cli' }
    : { provider: null, reason: '연결된 공급자가 없습니다.', blocking: 'need_bridge' };
}

export function send(provider: ProviderId, settings: Settings, opts: SendOptions): AsyncGenerator<StreamEvent> {
  if (provider === 'desktop') return streamDesktop(opts);
  if (provider === 'bridge') {
    return streamBridge({ ...opts, baseUrl: settings.bridgeUrl, token: settings.bridgeToken });
  }
  return streamApiKey({ ...opts, apiKey: settings.apiKey });
}

/** 데스크톱 앱에서는 IPC로, 웹에서는 브리지 HTTP로 로그인 흐름을 시작한다 */
export async function startLocalLogin(
  settings: Settings,
): Promise<{ ok: boolean; message?: string; hint?: string | null; pageUrl?: string; inApp?: boolean }> {
  const api = desktopApi();
  if (api) {
    const result = await api.login();
    return { ok: result.ok, message: result.message, hint: result.hint ?? null, inApp: true };
  }
  const { startLogin } = await import('./bridge');
  return startLogin(settings.bridgeUrl, settings.bridgeToken);
}
