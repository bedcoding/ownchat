/**
 * 작품 텍스트의 플랫폼 이름 치환.
 *
 * 시나리오는 실제 회사를 소재로 하지만, 공개 저장소에 실명을 넣지 않는다.
 * 커밋되는 데이터에는 `{PLATFORM}` 토큰만 들어가고, 실제 이름은
 * **gitignore 된 `.env.local`** 에서 주입한다.
 *
 *   apps/rpg/.env.local
 *   NEXT_PUBLIC_PLATFORM_NAME=우리회사이름
 *
 * 값을 주지 않으면 가상의 이름으로 떨어진다. 저장소를 클론한 사람도
 * 깨진 문자열이 아니라 **완결된 게임**을 보게 하려는 것이다
 * (토큰을 그대로 노출하면 그 장면들이 전부 읽히지 않는다).
 *
 * `NEXT_PUBLIC_` 접두사가 있어야 Next 가 빌드 시점에 클라이언트 번들로 인라인한다.
 */

/** 실명을 주지 않았을 때 쓰는 가상 플랫폼 이름 */
const DEFAULT_PLATFORM = '먹줄';

export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || DEFAULT_PLATFORM;

/** 문자열 하나를 치환한다 */
export function brand(text: string): string {
  return text.split('{PLATFORM}').join(PLATFORM_NAME);
}

/**
 * 작품 전체를 치환한 사본을 만든다.
 *
 * 필드를 하나씩 훑는 대신 직렬화된 형태에서 한 번에 바꾼다.
 * `Work` 는 정의상 JSON 직렬화가 가능하므로(types.ts) 안전하고,
 * 새 텍스트 필드가 생겨도 여기를 고칠 필요가 없다.
 *
 * **원본은 건드리지 않는다.** 저작 도구는 토큰이 든 원본을 계속 편집하고,
 * 치환은 화면에 그릴 때만 일어난다. 그래서 관리자가 편집·발행한 JSON 에
 * 실명이 섞여 들어가지 않는다.
 */
export function brandWork<T>(work: T): T {
  const raw = JSON.stringify(work);
  return raw.includes('{PLATFORM}') ? (JSON.parse(brand(raw)) as T) : work;
}
