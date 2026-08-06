/**
 * 사전 생성 선택지 트리의 데이터 모델.
 *
 * 핵심 전제: **플레이 중에는 AI가 돌지 않는다.** 관리자가 저작 시점에 한 번 생성·검수해서
 * 발행한 그래프를 플레이어가 걷기만 한다. 그래서 이 타입들은 전부 직렬화 가능해야 하고
 * (JSON 내보내기/가져오기로 기기 간 이동), 런타임 판정은 순수 함수로 끝나야 한다.
 *
 * 예외가 하나 있다 — `Probe`(심문 노드). 그 노드에서만 런타임 AI가 필요하고, 심문 노드를
 * 하나도 쓰지 않은 작품은 위 전제가 그대로 유지된다. 즉 **AI 사용 여부는 앱이 아니라
 * 작품이 정한다** (`requiresRuntimeAI()` 가 데이터에서 판정한다).
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

/**
 * 확률 분기 하나.
 *
 * "때린다 (30% 확률로 체력 -1)" 처럼 고른 결과가 갈리는 선택지를 위한 것이다.
 * `next` 를 비우면 선택지의 기본 `next` 로 간다 — 결과 텍스트만 다르고 장면은 같은 경우.
 */
export interface Outcome {
  /** 이 결과가 나올 확률(%). 목록의 합이 100 미만이면 나머지는 "아무 일도 없음" */
  chance: number;
  /** 굴림 결과를 플레이어에게 알리는 한 줄 ("주먹이 빗나갔다") */
  text?: string;
  effects?: Effects;
  /** 이 결과일 때 갈 노드. 비우면 `Choice.next` */
  next?: string;
}

export interface Choice {
  label: string;
  next: string;
  requires?: Requirement;
  effects?: Effects;
  /**
   * 확률 분기. 있으면 고른 순간 굴린다.
   *
   * `effects` 와 함께 쓸 수 있다 — `effects` 는 확정 대가(고른 것만으로 발생),
   * `outcomes` 는 운에 달린 부분이다. 예: 도망(확정 돈 -1) + 30% 추격당함.
   */
  outcomes?: Outcome[];
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

// ── 심문 노드 (유일하게 런타임 AI 를 쓰는 곳) ──────────────────

/**
 * 대화에서 특정 사실에 도달했을 때 주는 것.
 *
 * **판정은 모델이 하지 않는다.** 응답 텍스트에 `when` 의 문구가 나타나면 준다.
 * 모델에게 "아이템을 지급하라" 같은 권한을 주면 프롬프트 인젝션 한 줄로 게임이 무너지고,
 * 검수 가능성(모든 상태 변화가 사전에 열거되어 있다)도 함께 사라진다.
 */
export interface ProbeUnlock {
  /** 이 문구 중 하나라도 응답에 나오면 성립 */
  when: string[];
  effects: Effects;
  /** 획득을 알리는 문구 ("메모의 필적이 집사의 것이라는 걸 알아냈다") */
  notice: string;
}

/**
 * 모델에게 주는 심문 상대의 설정. **발행 시 `Probe.sealed` 안에 봉인된다.**
 *
 * 정적 배포에서는 이 내용이 결국 사용자 기기에 내려간다. 봉인은 개발자 도구를 열었을 때
 * 진상이 그냥 읽히는 것을 막는 수준이고, 작정하고 뜯으면 복원된다 — 세이브 파일 편집과
 * 같은 층위의 한계이고, 서버를 두지 않기로 한 대가다.
 */
export interface ProbeBrief {
  /** 이 인물이 누구이고 어떤 태도인지 */
  persona: string;
  /** 물으면 말해도 되는 것 */
  knows: string[];
  /** 절대 말하면 안 되는 것 (진상 보호) */
  withholds?: string[];
  unlocks?: ProbeUnlock[];
}

/** 자유 질문으로 목격자를 심문하는 노드. 이 노드가 있는 작품만 런타임 AI 가 필요하다 */
export interface Probe {
  /** 심문 상대의 이름 (화면 표시용) */
  who: string;
  /** 심문 화면 안내 ("집사는 문 앞에 서 있다. 무엇이든 물어볼 수 있다") */
  intro: string;
  /** 봉인된 `ProbeBrief` JSON — `lib/seal.ts` 로 만든다 */
  sealed: string;
  /** 질문 횟수 제한. 비우면 무제한 (토큰을 쓰는 쪽이 사용자라 기본은 제한을 권한다) */
  maxTurns?: number;
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
  /**
   * 있으면 심문 노드 — 선택지 위에 자유 질문 창이 붙는다.
   * `choices` 는 그대로 필요하다 (심문을 끝내고 나갈 길).
   */
  probe?: Probe;
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
  log: {
    episodeIndex: number;
    nodeId: string;
    text: string;
    speaker?: string;
    choice?: string;
    /** 확률 분기가 굴려졌다면 그 결과 문구 */
    outcome?: string;
  }[];
  /** 수집한 엔딩 (kind !== 'advance' 인 것) */
  endings: { episodeIndex: number; title: string }[];
  /**
   * 심문 노드에서 쓴 질문 수 (nodeId → 횟수).
   * 상태에 남겨야 노드를 나갔다 들어오는 것으로 `maxTurns` 를 우회할 수 없다.
   * 심문 노드가 없는 작품에서는 계속 비어 있다.
   */
  probeTurns?: Record<string, number>;
  /**
   * 이미 성립한 심문 해금 (`<nodeId>:<규칙 index>`).
   *
   * 없으면 같은 사실을 여러 번 말하게 유도해 능력치를 반복해서 올릴 수 있다.
   * 해금은 "알아낸 사실" 이므로 한 번만 성립하는 것이 맞다.
   */
  probeUnlocked?: string[];
}
