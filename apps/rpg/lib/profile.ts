/**
 * 배포 프로파일.
 *
 * 같은 코드에서 서로 다른 물건이 나온다 — 관리자용 저작 도구, 그리고 장르가 다른
 * 사용자용 앱들. 코드를 쪼개는 대신 **어떤 화면과 어떤 작품을 싣는지**로 갈린다.
 * 엔진·러너·저작 도구를 두 벌 유지하는 비용이 여기서 사라진다.
 *
 * | 프로파일 | 화면 | 수록 작품 | 쓰임 |
 * |---|---|---|---|
 * | `admin`  | `/play` + `/admin` | 전부 | 관리자 (Electron 포장 대상) |
 * | `player` | `/play`            | 전부 | 기본 사용자 빌드 |
 * | 그 밖의 값 | `/play`          | 그 id 의 작품만 | 단일 작품 출시 (스토어에 따로 낼 때) |
 *
 * `/admin` 라우트는 코드 안에서 숨기는 것이 아니라 **빌드 자체에서 빠진다** —
 * `next.config.mjs` 의 `pageExtensions` 가 `page.admin.tsx` 를 페이지로 인식하지 않으면
 * 그 파일과 거기서만 import 하는 저작 도구 코드 전부가 번들에 들어가지 않는다.
 *
 * ```bash
 * npm run rpg:build              # player — 사용자용, 관리자 화면 없음
 * npm run rpg:build:admin        # admin  — 저작 도구 포함
 * RPG_PROFILE=snowlodge npm run rpg:build   # 「눈에 갇힌 산장」만 수록
 * ```
 */

/** 빌드 시점에 인라인된다 (`NEXT_PUBLIC_` 접두사가 있어야 클라이언트 번들에 박힌다) */
export const PROFILE = process.env.NEXT_PUBLIC_RPG_PROFILE || 'admin';

export const isAdminBuild = PROFILE === 'admin';
export const isHostedBuild = PROFILE === 'hosted';

/** 이 프로파일이 이 작품을 수록하는가 */
export function includesWork(id: string): boolean {
  if (PROFILE === 'admin' || PROFILE === 'player' || PROFILE === 'hosted') return true;
  return PROFILE === id;
}
