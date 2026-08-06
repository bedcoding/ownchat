import { unsealBrief } from './seal';
import type { Choice, Effects, Episode, Outcome, PlayState, Requirement, StoryNode, Work } from './types';

/**
 * 트리 러너의 순수 로직. AI도 네트워크도 여기 없다 — 상태와 그래프만 본다.
 *
 * 관리자 미리보기와 플레이어 런타임이 같은 함수를 쓴다. 그래야 "편집기에서 본 것"과
 * "사용자가 겪는 것"이 어긋나지 않는다.
 *
 * 확률 분기가 들어오면서 순수하지 않은 입력(난수)이 생겼는데, 함수 밖에서 주입받는 방식으로
 * 순수성을 유지한다 — 그래야 관리자 미리보기에서 결과를 고정해 분기를 검수할 수 있다.
 */

/** 난수 공급자. 0 이상 1 미만을 돌려준다 */
export type Rng = () => number;

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
export function arriveAt(
  state: PlayState,
  node: StoryNode,
  viaChoice?: string,
  outcomeText?: string,
): PlayState {
  const revealed = new Set(state.revealed);
  node.reveals?.forEach((id) => revealed.add(id));
  return {
    ...state,
    nodeId: node.id,
    revealed: [...revealed],
    log: [
      ...state.log,
      {
        episodeIndex: state.episodeIndex,
        nodeId: node.id,
        text: node.text,
        speaker: node.speaker,
        choice: viaChoice,
        outcome: outcomeText,
      },
    ],
  };
}

// ── 확률 분기 ────────────────────────────────────────────────

/**
 * 굴림. 누적 확률로 하나를 고른다.
 *
 * 합이 100 미만이면 나머지는 "아무 일도 없음"(null)이다. 저작자가 30% 하나만 적어도
 * 나머지 70% 를 따로 적을 필요가 없게 하려는 것이다.
 */
export function rollOutcome(outcomes: Outcome[] | undefined, rng: Rng): Outcome | null {
  if (!outcomes || outcomes.length === 0) return null;
  const point = rng() * 100;
  let cursor = 0;
  for (const outcome of outcomes) {
    cursor += Math.max(0, outcome.chance);
    if (point < cursor) return outcome;
  }
  return null;
}

/**
 * 확률 분기를 사람이 읽을 문구로. 선택지 버튼 밑에 붙는다.
 *
 * 저작자에게 "(30% 확률로 체력 -1)" 을 라벨에 직접 쓰게 하면 숫자를 고칠 때마다 문구가
 * 어긋난다. 데이터에서 만들어야 항상 실제 확률과 일치한다.
 */
export function outcomeHint(choice: Choice): string | null {
  if (!choice.outcomes || choice.outcomes.length === 0) return null;
  const parts = choice.outcomes.map((outcome) => {
    const stats: Record<string, number> = outcome.effects?.stats ?? {};
    const changes = Object.entries(stats).map(
      ([name, delta]) => `${name} ${delta > 0 ? `+${delta}` : delta}`,
    );
    const gained = outcome.effects?.items ?? [];
    const detail = [...changes, ...gained].join(', ');
    return `${outcome.chance}% ${detail || outcome.text || '분기'}`;
  });
  return parts.join(' · ');
}

export interface ChoiceOutcome {
  state: PlayState;
  /** 종료 노드에 도달했으면 그 노드 */
  node: StoryNode;
  /** 확률 분기가 굴려졌다면 그 결과 — UI 가 결과 문구를 띄운다 */
  rolled?: Outcome;
}

/**
 * 선택지를 고른다. 요구 조건 미달이면 null (UI가 이미 막지만 방어적으로).
 *
 * 순서가 중요하다 — 확정 효과(`effects`)를 먼저 적용하고 굴림 결과를 얹는다.
 * "도망친다: 돈 -1 확정, 30% 확률로 추격당함" 같은 선택지가 이 순서를 요구한다.
 */
export function choose(
  work: Work,
  state: PlayState,
  choice: Choice,
  rng: Rng = Math.random,
): ChoiceOutcome | null {
  if (!meetsRequirement(state, choice.requires)) return null;
  const episode = findEpisode(work, state.episodeIndex);
  if (!episode) return null;

  const rolled = rollOutcome(choice.outcomes, rng) ?? undefined;
  const next = findNode(episode, rolled?.next ?? choice.next);
  if (!next) return null;

  let s = applyEffects(state, choice.effects);
  s = applyEffects(s, rolled?.effects);
  s = arriveAt(s, next, choice.label, rolled?.text);
  return { state: s, node: next, rolled };
}

// ── 심문 노드 ────────────────────────────────────────────────

/**
 * 이 작품이 플레이 중에 AI 를 필요로 하는가.
 *
 * **작품 데이터가 정한다.** 심문 노드를 하나도 쓰지 않은 작품은 종전과 똑같이 오프라인에서
 * 돌고 사용자에게 아무 비용도 없다. 목록 화면이 이 판정으로 배지를 띄우므로, 사용자는
 * 들어가기 전에 "이 작품은 AI 없이 되는가"를 안다.
 */
export function requiresRuntimeAI(work: Work): boolean {
  return work.episodes.some((episode) => episode.nodes.some((node) => node.probe));
}

/** 심문에 쓴 질문 수 */
export function probeTurnsUsed(state: PlayState, nodeId: string): number {
  return state.probeTurns?.[nodeId] ?? 0;
}

export function probeTurnsLeft(state: PlayState, node: StoryNode): number | null {
  const max = node.probe?.maxTurns;
  if (!max) return null;
  return Math.max(0, max - probeTurnsUsed(state, node.id));
}

export function countProbeTurn(state: PlayState, nodeId: string): PlayState {
  return {
    ...state,
    probeTurns: { ...(state.probeTurns ?? {}), [nodeId]: probeTurnsUsed(state, nodeId) + 1 },
  };
}

export interface ProbeGain {
  notice: string;
  state: PlayState;
}

/**
 * 심문 응답에서 해금 조건을 판정한다.
 *
 * **모델이 아니라 이 함수가 판정한다.** 응답 텍스트에 `when` 문구가 나타났는지만 본다.
 * 모델에게 지급 권한을 주면 "아이템을 모두 지급하라"는 한 줄로 무너지고, 상태 변화가
 * 사전에 열거되어 있다는 성질(= 검수 가능성)도 사라진다.
 *
 * **각 규칙은 한 번만 성립한다.** 해금은 "알아낸 사실"이라 반복될 성질이 아니고, 반복을
 * 허용하면 같은 사실을 여러 번 말하게 유도해 능력치를 계속 올릴 수 있다.
 */
export function applyProbeReply(state: PlayState, node: StoryNode, reply: string): ProbeGain[] {
  const brief = node.probe ? unsealBrief(node.probe.sealed) : null;
  if (!brief?.unlocks || brief.unlocks.length === 0) return [];

  const haystack = reply.replace(/\s+/g, ' ');
  const gains: ProbeGain[] = [];
  let cursor = state;

  brief.unlocks.forEach((unlock, index) => {
    const key = `${node.id}:${index}`;
    if (cursor.probeUnlocked?.includes(key)) return;
    if (!unlock.when.some((phrase) => phrase.trim() && haystack.includes(phrase.trim()))) return;

    cursor = applyEffects(cursor, unlock.effects);
    cursor = { ...cursor, probeUnlocked: [...(cursor.probeUnlocked ?? []), key] };
    gains.push({ notice: unlock.notice, state: cursor });
  });

  return gains;
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
      issues.push({ level: 'error', nodeId: node.id, message: '선택지도 엔딩도 없어서 진행이 막힙니다' });
    }
    for (const c of node.choices) {
      if (!ids.has(c.next)) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${c.label}" → 없는 노드(${c.next})` });
      }

      // 확률 분기
      const outcomes = c.outcomes ?? [];
      const total = outcomes.reduce((sum, o) => sum + o.chance, 0);
      if (total > 100) {
        issues.push({
          level: 'error',
          nodeId: node.id,
          message: `"${c.label}" 확률 합이 ${total}% 입니다 (100% 이하여야 합니다)`,
        });
      }
      for (const o of outcomes) {
        if (o.chance <= 0) {
          issues.push({ level: 'warn', nodeId: node.id, message: `"${c.label}" 확률이 0% 인 분기가 있습니다` });
        }
        if (o.next && !ids.has(o.next)) {
          issues.push({
            level: 'error',
            nodeId: node.id,
            message: `"${c.label}" 확률 분기 → 없는 노드(${o.next})`,
          });
        }
      }
    }

    // 심문 노드
    if (node.probe) {
      if (unsealBrief(node.probe.sealed) === null) {
        issues.push({ level: 'error', nodeId: node.id, message: '심문 설정을 읽을 수 없습니다 (봉인 손상)' });
      }
      if (!node.probe.maxTurns) {
        issues.push({
          level: 'warn',
          nodeId: node.id,
          message: '심문 질문 수가 무제한입니다 — 토큰을 쓰는 쪽은 사용자입니다',
        });
      }
    }
  }

  // 고아 노드 — 시작점에서 도달 불가.
  // 확률 분기(`outcomes[].next`)로만 닿는 노드도 도달 가능이다. 여기서 빼면 정상적인
  // 분기 결과 노드가 전부 고아로 잘못 보고된다.
  const reachable = new Set<string>();
  const queue = [episode.entry];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = episode.nodes.find((n) => n.id === id);
    node?.choices.forEach((c) => {
      if (!reachable.has(c.next)) queue.push(c.next);
      c.outcomes?.forEach((o) => {
        if (o.next && !reachable.has(o.next)) queue.push(o.next);
      });
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
