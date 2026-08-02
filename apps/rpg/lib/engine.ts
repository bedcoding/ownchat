import type { Choice, Effects, Episode, PlayState, Requirement, StoryNode, Work } from './types';

/**
 * 트리 러너의 순수 로직. AI도 네트워크도 여기 없다 — 상태와 그래프만 본다.
 *
 * 관리자 미리보기와 플레이어 런타임이 같은 함수를 쓴다. 그래야 "편집기에서 본 것"과
 * "사용자가 겪는 것"이 어긋나지 않는다.
 */

export function initialState(work: Work): PlayState {
  const first = work.episodes[0];
  return {
    workId: work.id,
    episodeIndex: first?.index ?? 1,
    nodeId: first?.entry ?? '',
    stats: { ...work.stats },
    flags: [],
    items: [],
    revealed: [],
    log: [],
    endings: [],
  };
}

export function findEpisode(work: Work, index: number): Episode | undefined {
  return work.episodes.find((e) => e.index === index);
}

export function findNode(episode: Episode, id: string): StoryNode | undefined {
  return episode.nodes.find((n) => n.id === id);
}

/** 요구 조건을 만족하는가. 조건이 없으면 항상 참 */
export function meetsRequirement(state: PlayState, req?: Requirement): boolean {
  if (!req) return true;
  if (req.stats) {
    for (const [key, min] of Object.entries(req.stats)) {
      if ((state.stats[key] ?? 0) < min) return false;
    }
  }
  if (req.flags?.some((f) => !state.flags.includes(f))) return false;
  if (req.notFlags?.some((f) => state.flags.includes(f))) return false;
  if (req.items?.some((i) => !state.items.includes(i))) return false;
  return true;
}

/**
 * 잠긴 이유를 사람이 읽을 문구로.
 * 저작자가 `lockedHint` 를 쓰면 그걸 우선한다 — 서사적인 문구가 기계적 안내보다 낫다.
 */
export function lockedReason(state: PlayState, choice: Choice): string | null {
  if (meetsRequirement(state, choice.requires)) return null;
  if (choice.lockedHint) return choice.lockedHint;

  const req = choice.requires;
  const parts: string[] = [];
  if (req?.stats) {
    for (const [key, min] of Object.entries(req.stats)) {
      if ((state.stats[key] ?? 0) < min) parts.push(`${key} ${min}`);
    }
  }
  if (req?.items) {
    for (const item of req.items) if (!state.items.includes(item)) parts.push(item);
  }
  // 플래그는 내부 식별자라 그대로 노출하지 않는다 — 저작자가 lockedHint 를 쓰게 유도한다.
  if (parts.length === 0) return '아직 이 선택지를 고를 수 없다';
  return `${parts.join(', ')} 필요`;
}

function applyEffects(state: PlayState, effects?: Effects): PlayState {
  if (!effects) return state;
  const stats = { ...state.stats };
  for (const [key, delta] of Object.entries(effects.stats ?? {})) {
    stats[key] = (stats[key] ?? 0) + delta;
  }
  const flags = new Set(state.flags);
  effects.flags?.forEach((f) => flags.add(f));
  effects.removeFlags?.forEach((f) => flags.delete(f));
  const items = new Set(state.items);
  effects.items?.forEach((i) => items.add(i));
  effects.removeItems?.forEach((i) => items.delete(i));
  return { ...state, stats, flags: [...flags], items: [...items] };
}

/**
 * 노드에 도착했을 때의 부수 효과 — 캐릭터 해금과 사건 기록.
 * 선택 결과와 분리해 둔 이유: 에피소드 시작 노드처럼 선택 없이 도착하는 경우도 있다.
 */
export function arriveAt(state: PlayState, node: StoryNode, viaChoice?: string): PlayState {
  const revealed = new Set(state.revealed);
  node.reveals?.forEach((id) => revealed.add(id));
  return {
    ...state,
    nodeId: node.id,
    revealed: [...revealed],
    log: [
      ...state.log,
      { episodeIndex: state.episodeIndex, nodeId: node.id, text: node.text, speaker: node.speaker, choice: viaChoice },
    ],
  };
}

export interface ChoiceOutcome {
  state: PlayState;
  /** 종료 노드에 도달했으면 그 노드 */
  node: StoryNode;
}

/** 선택지를 고른다. 요구 조건 미달이면 null (UI가 이미 막지만 방어적으로) */
export function choose(work: Work, state: PlayState, choice: Choice): ChoiceOutcome | null {
  if (!meetsRequirement(state, choice.requires)) return null;
  const episode = findEpisode(work, state.episodeIndex);
  if (!episode) return null;
  const next = findNode(episode, choice.next);
  if (!next) return null;

  let s = applyEffects(state, choice.effects);
  s = arriveAt(s, next, choice.label);
  return { state: s, node: next };
}

/**
 * 종료 노드를 처리한다.
 * - `advance`: 다음 화로. 스탯·플래그·아이템·도감은 그대로 이월된다 (콜백의 근거)
 * - `fail`: 이 화를 처음부터. 엔딩은 수집 목록에 남는다
 * - `final`: 완결
 */
export function resolveEnding(work: Work, state: PlayState, node: StoryNode): PlayState {
  const ending = node.ending;
  if (!ending) return state;

  const endings =
    ending.kind === 'advance'
      ? state.endings
      : [...state.endings, { episodeIndex: state.episodeIndex, title: ending.title }];

  if (ending.kind === 'advance') {
    const next = findEpisode(work, state.episodeIndex + 1);
    if (!next) return { ...state, endings };
    const entry = findNode(next, next.entry);
    const advanced: PlayState = { ...state, endings, episodeIndex: next.index, nodeId: next.entry };
    return entry ? arriveAt(advanced, entry) : advanced;
  }

  if (ending.kind === 'fail') {
    // 이 화만 되감는다. 이전 화에서 얻은 것은 유지 — 재시도 비용을 낮춘다.
    const episode = findEpisode(work, state.episodeIndex);
    if (!episode) return { ...state, endings };
    const entry = findNode(episode, episode.entry);
    const restarted: PlayState = { ...state, endings, nodeId: episode.entry };
    return entry ? arriveAt(restarted, entry) : restarted;
  }

  return { ...state, endings };
}

/** 다음 화가 있는가 (advance 엔딩에서 "완결"과 구분하기 위해) */
export function hasNextEpisode(work: Work, state: PlayState): boolean {
  return findEpisode(work, state.episodeIndex + 1) !== undefined;
}

// ── 편집기용 검증 ────────────────────────────────────────────

export interface GraphIssue {
  level: 'error' | 'warn';
  nodeId: string;
  message: string;
}

/**
 * 그래프 무결성 검사. 편집기가 저작 중에 계속 돌린다 —
 * 끊긴 링크와 고아 노드는 저작 단계에서 잡아야 플레이 중에 막히지 않는다.
 */
export function validateEpisode(episode: Episode): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set(episode.nodes.map((n) => n.id));

  if (!ids.has(episode.entry)) {
    issues.push({ level: 'error', nodeId: episode.entry, message: '시작 노드가 존재하지 않습니다' });
  }

  // 끊긴 링크
  for (const node of episode.nodes) {
    if (node.ending) continue;
    if (node.choices.length === 0) {
      issues.push({ level: 'error', nodeId: node.id, message: '선택지도 엔딩도 없습니다 — 진행이 막힙니다' });
    }
    for (const c of node.choices) {
      if (!ids.has(c.next)) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${c.label}" → 없는 노드(${c.next})` });
      }
    }
  }

  // 고아 노드 — 시작점에서 도달 불가
  const reachable = new Set<string>();
  const queue = [episode.entry];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = episode.nodes.find((n) => n.id === id);
    node?.choices.forEach((c) => {
      if (!reachable.has(c.next)) queue.push(c.next);
    });
  }
  for (const node of episode.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({ level: 'warn', nodeId: node.id, message: '시작 노드에서 도달할 수 없습니다' });
    }
  }

  // 진행 가능성 — advance 엔딩이 하나도 없으면 다음 화로 갈 길이 없다
  if (!episode.nodes.some((n) => n.ending?.kind === 'advance' || n.ending?.kind === 'final')) {
    issues.push({ level: 'warn', nodeId: episode.entry, message: '다음 화로 가는 엔딩(advance)이 없습니다' });
  }

  return issues;
}
