/**
 * 사전 생성 선택지 트리의 데이터 모델.
 *
 * 핵심 전제: **플레이 중에는 AI가 돌지 않는다.** 관리자가 저작 시점에 한 번 생성·검수해서
 * 발행한 그래프를 플레이어가 걷기만 한다. 그래서 이 타입들은 전부 직렬화 가능해야 하고
 * (JSON 내보내기/가져오기로 기기 간 이동), 런타임 판정은 순수 함수로 끝나야 한다.
 */

/** 작품 등급. 성인 작품은 사전 검수된 콘텐츠라 서빙 정책이 자체 등급을 따른다 */
export type Rating = 'all' | 'adult';

/** 선택지를 고를 수 있는 조건. 미달이면 버튼이 비활성으로 **보이는** 채 남는다 */
export interface Requirement {
  /** 능력치 최소 요구치 { 설득: 3 } */
  stats?: Record<string, number>;
  /** 갖고 있어야 하는 플래그 */
  flags?: string[];
  /** 갖고 있으면 안 되는 플래그 */
  notFlags?: string[];
  /** 갖고 있어야 하는 아이템 */
  items?: string[];
}

/** 선택지를 고른 결과 상태 변화 */
export interface Effects {
  /** 능력치 증감 { 설득: +1, 체력: -2 } */
  stats?: Record<string, number>;
  flags?: string[];
  removeFlags?: string[];
  items?: string[];
  removeItems?: string[];
}

export interface Choice {
  label: string;
  next: string;
  requires?: Requirement;
  effects?: Effects;
  /**
   * 잠긴 상태에서 보여줄 문구. 없으면 `requires` 로부터 자동 생성한다.
   * 저작자가 서사적인 문구로 덮어쓸 수 있게 열어 둔다 ("아직 그를 믿지 못한다").
   */
  lockedHint?: string;
}

/**
 * 엔딩 종류.
 * - `advance`: 목표 달성 → 다음 화로 자동 진행 (이 게임의 메인 루프)
 * - `fail`: 조기 종료 → 이 화 재시작. 수집 대상 엔딩이기도 하다
 * - `final`: 작품 완결
 */
export type EndingKind = 'advance' | 'fail' | 'final';

export interface Ending {
  kind: EndingKind;
  title: string;
  text: string;
}

export interface StoryNode {
  id: string;
  /** 비우면 GM 내레이션, 채우면 그 캐릭터의 대사 */
  speaker?: string;
  text: string;
  /** 장면 일러스트 (웹툰 컷 자리). 데이터 URL 또는 경로 */
  image?: string;
  /** 이 노드에 도달하면 해금되는 캐릭터 id 목록 (도감용) */
  reveals?: string[];
  choices: Choice[];
  /** 있으면 종료 노드 — choices 는 무시된다 */
  ending?: Ending;
}

export interface Character {
  id: string;
  name: string;
  /** 도감에 뜨는 한 줄 소개 */
  intro: string;
}

export interface Episode {
  id: string;
  /** 회차 번호 (1화, 2화…) */
  index: number;
  title: string;
  /** 시작 노드 id */
  entry: string;
  nodes: StoryNode[];
  /** 이전 화를 마치고 들어올 때 보여줄 요약 */
  recap?: string;
}

export interface Work {
  id: string;
  title: string;
  rating: Rating;
  /** 능력치 정의와 시작값 { 설득: 1, 무력: 1, 통찰: 1 } */
  stats: Record<string, number>;
  characters: Character[];
  episodes: Episode[];
}

// ── 플레이 상태 ────────────────────────────────────────────────

export interface PlayState {
  workId: string;
  /** 현재 화 index */
  episodeIndex: number;
  nodeId: string;
  stats: Record<string, number>;
  flags: string[];
  items: string[];
  /** 해금된 캐릭터 id */
  revealed: string[];
  /** 사건 기록 — 지나온 노드의 서술 로그 */
  log: { episodeIndex: number; nodeId: string; text: string; speaker?: string; choice?: string }[];
  /** 수집한 엔딩 (kind !== 'advance' 인 것) */
  endings: { episodeIndex: number; title: string }[];
}
