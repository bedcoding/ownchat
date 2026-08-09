import { isDesktop } from './providers/desktop';

/**
 * 이 기기에서 구독 경로(= 내 PC의 Claude Code)를 쓸 수 있는가.
 *
 * 폰·태블릿에서는 불가능하다. Claude Code는 Node.js CLI라 iOS·Android에서 돌지 않고,
 * 구독 토큰을 서버로 보내는 것은 Anthropic이 금지한 구조다. 개발로 해결되는 문제가 아니다.
 *
 * User-Agent를 파싱하지 않는 이유: 문자열은 위조되고 새 기기마다 깨진다. 대신 "이 기기가
 * 로컬 프로세스를 띄울 수 있는 종류인가"에 대한 실질적 신호를 본다 —
 * 정밀 포인터가 없고(터치 전용) 화면이 좁으면 폰·태블릿이다.
 *
 * `&&` 로 묶은 것이 중요하다. 터치 스크린 노트북은 `pointer: fine` 을 보고하므로 걸리지 않고,
 * 데스크톱에서 창을 좁게 줄인 경우도 걸리지 않는다. 즉 오분류의 방향이 안전한 쪽이다.
 */
export function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 900px)').matches;
}

/**
 * 구독 경로를 화면에 제안할 가치가 있는가.
 *
 * 데스크톱 앱 안에서는 당연히 가능하다. 웹에서는 로컬 브리지를 띄울 수 있는 기기여야 한다.
 * 이 값이 false면 UI는 브리지 이야기를 아예 꺼내지 않는다 — 폰에서 "터미널을 여세요"는
 * 실행할 수 없는 안내이고, 그런 안내는 도움이 아니라 이탈 사유다.
 */
export function subscriptionPossible(): boolean {
  return isDesktop() || !isTouchOnlyDevice();
}

/** 서버가 OpenAI 키를 보관하는 공모전용 호스팅 프로필인가. */
export function hostedOpenAIAvailable(): boolean {
  return process.env.NEXT_PUBLIC_OWNCHAT_HOSTED === '1';
}
