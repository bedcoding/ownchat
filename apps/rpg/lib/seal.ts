import type { ProbeBrief } from './types';

/**
 * 심문 설정(진상)을 발행 JSON 안에서 봉인한다.
 *
 * **이건 암호가 아니다.** 정적 배포에서는 작품 데이터가 결국 사용자 기기로 내려가므로,
 * 열쇠도 같이 내려간다. 봉인의 목적은 딱 하나 — 개발자 도구를 열거나 JSON 을 텍스트
 * 편집기로 열었을 때 **범인 이름이 그냥 눈에 들어오는 것**을 막는 것이다.
 * 작정하고 뜯는 사람은 복원할 수 있고, 그건 싱글플레이 게임의 세이브 편집과 같은 층위다.
 *
 * 진짜로 못 뜯게 하려면 심문 판정을 서버에 두어야 하는데, 그러면 이 프로젝트가 포기한 것
 * (서버 없음 · 오프라인 · 사용자당 원가 0)을 되돌리는 일이 된다. 그래서 여기까지가 한계다.
 */

const KEY = 'ownchat-rpg-probe-v1';

function xorBytes(bytes: Uint8Array): Uint8Array {
  const key = new TextEncoder().encode(KEY);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[i] = bytes[i] ^ key[i % key.length];
  return out;
}

/**
 * 유니코드가 섞여 있어도 안전하게 — btoa 는 라틴1 밖의 문자에서 던지므로 바이트 단위로 넘긴다.
 *
 * 번들 샘플이 모듈 로드 시점에 봉인을 만들기 때문에 이 함수들은 **빌드 중(Node)에도** 돈다.
 * Node 20 에는 btoa/atob 가 전역으로 있지만, 없는 런타임에서도 깨지지 않게 폴백을 둔다.
 */
function toBase64(bytes: Uint8Array): string {
  let latin1 = '';
  for (const b of bytes) latin1 += String.fromCharCode(b);
  if (typeof btoa === 'function') return btoa(latin1);
  return Buffer.from(latin1, 'latin1').toString('base64');
}

function fromBase64(text: string): Uint8Array {
  const latin1 = typeof atob === 'function' ? atob(text) : Buffer.from(text, 'base64').toString('latin1');
  const out = new Uint8Array(latin1.length);
  for (let i = 0; i < latin1.length; i += 1) out[i] = latin1.charCodeAt(i);
  return out;
}

export function sealBrief(brief: ProbeBrief): string {
  return toBase64(xorBytes(new TextEncoder().encode(JSON.stringify(brief))));
}

/** 봉인을 푼다. 깨진 값이면 null — 편집기가 "설정을 읽을 수 없습니다"로 보여준다 */
export function unsealBrief(sealed: string): ProbeBrief | null {
  try {
    const json = new TextDecoder().decode(xorBytes(fromBase64(sealed)));
    const brief = JSON.parse(json) as Partial<ProbeBrief>;
    if (typeof brief?.persona !== 'string' || !Array.isArray(brief.knows)) return null;
    return {
      persona: brief.persona,
      knows: brief.knows,
      withholds: brief.withholds ?? [],
      unlocks: brief.unlocks ?? [],
    };
  } catch {
    return null;
  }
}

export function emptyBrief(): ProbeBrief {
  return { persona: '', knows: [], withholds: [], unlocks: [] };
}
