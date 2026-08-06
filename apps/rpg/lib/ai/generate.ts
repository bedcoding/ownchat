import { newId } from '../authoring';
import { validateEpisode } from '../engine';
import type { Character, Episode, Work } from '../types';
import { askOnce } from './client';
import type { AiRoute, AiSettings } from './types';

/**
 * 설정 한 줄 → 선택지 트리 초안.
 *
 * **이 프로젝트에서 AI 가 가장 값을 내는 자리다.** 사람은 쓰는 사람이 아니라 고치는 사람이 되고,
 * 그 대가로 플레이 런타임에는 AI 가 한 번도 돌지 않는다.
 *
 * 출력은 구조화 출력(`output_config.format`) 대신 **프롬프트 + 파서**로 받는다. 구독 경로는
 * Claude Code CLI 를 통하는데 CLI 에는 그 파라미터가 없어서, 경로마다 다른 방식을 쓰면
 * "브리지로 뽑은 초안과 API 키로 뽑은 초안이 다르다"가 된다. 대신 검증기를 통과할 때까지
 * 한 번 되물어 실패율을 낮춘다.
 */

/** 초안의 크기. 한 번에 너무 크게 뽑으면 검수가 불가능하고 출력 길이 제한에도 걸린다 */
const NODE_TARGET = '8~14개';

const MODEL_SPEC = `
데이터 모델 (전부 JSON):

Work    { title, rating: "all"|"adult", stats: {이름:시작값}, characters: [{id,name,intro}], episodes: [Episode] }
Episode { index: 화수(정수), title, entry: 시작 노드 id, nodes: [Node], recap?: 이전 화 요약 }
Node    { id, speaker?: 화자(비우면 내레이션), text: 본문, reveals?: [해금되는 인물 id], choices: [Choice], ending?: Ending }
Choice  { label: 버튼 문구, next: 갈 노드 id, requires?: Requirement, effects?: Effects, outcomes?: [Outcome], lockedHint?: 잠김 문구 }
Outcome { chance: 확률(%), text?: 결과 한 줄, effects?: Effects, next?: 이 결과일 때 갈 노드 id }
Requirement { stats?: {이름:최소값}, flags?: [필요한 플래그], notFlags?: [없어야 할 플래그], items?: [필요한 아이템] }
Effects { stats?: {이름:증감}, flags?: [추가], removeFlags?: [제거], items?: [추가], removeItems?: [제거] }
Ending  { kind: "advance"(목표 달성, 다음 화로) | "fail"(이 화 재시작) | "final"(완결), title, text }

규칙:
- 노드 id 는 짧은 영문 소문자+숫자 (n1, n2, shop, alley …). 한 회차 안에서만 유일하면 된다.
- 모든 노드는 choices 가 있거나 ending 이 있어야 한다. 둘 다 없으면 진행이 막힌다.
- choices 의 next 와 outcomes 의 next 는 반드시 이 회차 안에 존재하는 노드 id 여야 한다.
- 시작 노드(entry)에서 모든 노드에 도달할 수 있어야 한다.
- ending 이 kind "advance" 인 노드가 최소 하나 있어야 한다 (다음 화로 가는 길).
- ending 이 kind "fail" 인 노드도 하나 이상 두어라 (실패 엔딩은 수집 대상이자 재플레이 동기다).
- requires.stats 와 effects.stats 의 이름은 반드시 stats 에 정의된 능력치여야 한다.
  정의되지 않은 이름을 쓰면 그 선택지는 영구히 잠긴다.
- outcomes 의 chance 합은 100 이하. 100 미만이면 나머지는 "아무 일도 없음"이다.
- 확률이 필요한 선택지에 outcomes 를 쓴다. 예: "때린다" → outcomes: [{chance:30, text:"주먹이 빗나가고 맞았다", effects:{stats:{체력:-1}}}]
- 확정 대가는 effects, 운에 달린 부분은 outcomes 다. 둘을 함께 쓸 수 있다.
- 요구치가 모자란 선택지는 숨지 않고 잠긴 채로 보인다. lockedHint 는 기계적 안내 대신
  서사적인 문구로 써라 ("아직 그를 믿지 못한다").
- 능력치는 2~4개, 이름은 짧은 한국어 명사 (설득, 무력, 통찰, 체력, 돈).
- 본문은 2~4문장. 선택지 문구는 12자 내외.
`.trim();

const SYSTEM = `
너는 선택지 게임의 시나리오 설계자다. 요청받은 회차의 선택지 트리를 JSON 으로 설계한다.

- 출력은 JSON 하나만. 설명·머리말·후기를 붙이지 마라. 코드 블록으로 감싸도 된다.
- 트리는 사람이 검수해서 고칠 초안이다. 완결성보다 구조적 정확성이 중요하다.
- 분기는 결과가 실제로 달라지게 만들어라. 문구만 다르고 같은 노드로 모이는 선택지는 가치가 없다.
- 한국어로 쓴다.
`.trim();

/** 새 작품 생성 결과 — 관리자 편집기에 그대로 투입된다 */
export interface DraftWork {
  title: string;
  rating: 'all' | 'adult';
  stats: Record<string, number>;
  characters: Character[];
  episode: Episode;
}

export interface GenerateFailure {
  message: string;
  hint?: string | null;
  /** 모델이 실제로 뱉은 것 — 관리자가 원인을 볼 수 있게 남긴다 */
  raw?: string;
}

// ── JSON 추출 ────────────────────────────────────────────────

/**
 * 응답 텍스트에서 JSON 객체를 뽑는다.
 *
 * 코드 블록으로 감싸는 경우, 앞뒤에 한 줄 설명을 붙이는 경우를 모두 받아 준다.
 * "JSON 만 출력하라"고 지시해도 모델은 종종 한 줄을 덧붙이는데, 그걸로 저작을 실패시키는 것은
 * 도구로서 부적절하다.
 */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter((s): s is string => typeof s === 'string');

  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      continue;
    }
  }
  return null;
}

// ── 검증 ────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 회차 하나를 검증한다. 그래프 검증은 편집기와 **같은 함수**(`validateEpisode`)를 쓴다 —
 * 생성 단계에서 통과한 트리가 편집기에서 오류로 뜨는 일이 없어야 한다.
 */
function checkEpisode(episode: Episode, statNames: string[]): string[] {
  const problems = validateEpisode(episode)
    .filter((i) => i.level === 'error')
    .map((i) => `${i.nodeId}: ${i.message}`);

  // 정의되지 않은 능력치 참조 — validateEpisode 는 그래프만 보므로 여기서 잡는다.
  // 없는 능력치를 요구하면 그 선택지가 영구히 잠기고, 원인이 눈에 잘 안 보인다.
  const known = new Set(statNames);
  for (const node of episode.nodes) {
    for (const choice of node.choices) {
      const referenced = [
        ...Object.keys(choice.requires?.stats ?? {}),
        ...Object.keys(choice.effects?.stats ?? {}),
        ...(choice.outcomes ?? []).flatMap((o) => Object.keys(o.effects?.stats ?? {})),
      ];
      for (const name of referenced) {
        if (!known.has(name)) {
          problems.push(`${node.id}: "${choice.label}" 이 정의되지 않은 능력치 "${name}" 을 씁니다`);
        }
      }
    }
  }
  return problems;
}

/** 모델 출력을 Episode 로 정규화한다. 형태가 아니면 null */
function toEpisode(raw: unknown, index: number): Episode | null {
  if (!isRecord(raw)) return null;
  const nodes = raw.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  if (typeof raw.entry !== 'string') return null;

  return {
    id: newId('ep'),
    index: typeof raw.index === 'number' ? raw.index : index,
    title: typeof raw.title === 'string' && raw.title ? raw.title : `${index}화`,
    entry: raw.entry,
    nodes: nodes.map((n) => {
      const node = isRecord(n) ? n : {};
      return {
        ...(node as object),
        id: String(node.id ?? newId('n')),
        text: typeof node.text === 'string' ? node.text : '',
        choices: Array.isArray(node.choices) ? node.choices : [],
      };
    }) as Episode['nodes'],
    recap: typeof raw.recap === 'string' ? raw.recap : undefined,
  };
}

// ── 생성 ────────────────────────────────────────────────────

export interface GenerateOptions {
  route: AiRoute;
  settings: AiSettings;
  /** 관리자가 쓴 설정 한 줄 (또는 여러 줄) */
  brief: string;
  signal: AbortSignal;
  onProgress?: (soFar: string) => void;
}

/**
 * 새 작품의 1화 초안을 만든다.
 *
 * 검증에 걸리면 오류 목록을 그대로 돌려주고 **한 번** 되묻는다. 두 번 이상 되묻지 않는 것은
 * 실패를 관리자에게 빨리 보여주는 쪽이 낫기 때문이다 — 토큰을 쓰는 것은 관리자 본인이다.
 */
export async function generateWorkDraft(
  opts: GenerateOptions,
): Promise<{ draft: DraftWork } | { error: GenerateFailure }> {
  const prompt = `
${MODEL_SPEC}

아래 설정으로 **새 작품의 1화**를 설계해라. 노드 ${NODE_TARGET}.

설정:
${opts.brief.trim()}

다음 형태의 JSON 하나만 출력해라:
{
  "title": "작품 제목",
  "rating": "all",
  "stats": { "능력치": 시작값 },
  "characters": [{ "id": "c1", "name": "이름", "intro": "한 줄 소개" }],
  "episode": { "index": 1, "title": "1화 제목", "entry": "시작 노드 id", "nodes": [ ... ] }
}
`.trim();

  const attempt = await runAttempt<DraftWork>(opts, prompt, (data) => {
    if (!isRecord(data)) return { ok: false, problems: ['JSON 객체가 아닙니다'] };
    const stats = isRecord(data.stats) ? (data.stats as Record<string, number>) : {};
    if (Object.keys(stats).length === 0) return { ok: false, problems: ['stats 가 비어 있습니다'] };

    const episode = toEpisode(data.episode, 1);
    if (!episode) return { ok: false, problems: ['episode 에 nodes 또는 entry 가 없습니다'] };

    const problems = checkEpisode(episode, Object.keys(stats));
    if (problems.length > 0) return { ok: false, problems };

    const characters = Array.isArray(data.characters)
      ? (data.characters as Character[]).filter((c) => isRecord(c) && typeof c.name === 'string')
      : [];

    return {
      ok: true,
      value: {
        title: typeof data.title === 'string' && data.title ? data.title : '새 작품',
        rating: data.rating === 'adult' ? 'adult' : 'all',
        stats,
        characters: characters.map((c) => ({ id: String(c.id ?? newId('c')), name: c.name, intro: c.intro ?? '' })),
        episode,
      },
    };
  });

  return attempt.ok ? { draft: attempt.value } : { error: attempt.error };
}

/**
 * 기존 작품에 다음 화를 붙인다.
 *
 * 앞 화의 플래그·아이템을 프롬프트에 넣어야 콜백이 성립한다 — 상태가 회차를 넘어 이월되는 것이
 * 이 엔진의 핵심이고, 그걸 모르면 모델이 매번 독립적인 단편을 쓴다.
 */
export async function generateEpisodeDraft(
  opts: GenerateOptions & { work: Work },
): Promise<{ episode: Episode } | { error: GenerateFailure }> {
  const { work } = opts;
  const nextIndex = Math.max(0, ...work.episodes.map((e) => e.index)) + 1;
  const statNames = Object.keys(work.stats);

  const carried = collectCarried(work);
  const prompt = `
${MODEL_SPEC}

기존 작품에 **${nextIndex}화**를 이어 붙여라. 노드 ${NODE_TARGET}.

작품: ${work.title}
능력치: ${statNames.join(', ') || '(없음)'}
등장인물: ${work.characters.map((c) => `${c.name}(${c.id})`).join(', ') || '(없음)'}
지금까지 쓰인 플래그: ${carried.flags.join(', ') || '(없음)'}
지금까지 쓰인 아이템: ${carried.items.join(', ') || '(없음)'}

직전 화 요약:
${summarize(work.episodes[work.episodes.length - 1])}

추가 요청:
${opts.brief.trim() || '(없음 — 앞 화에서 자연스럽게 이어라)'}

앞 화의 플래그를 requires 로 받는 선택지를 최소 하나 넣어라 (콜백).
Episode 하나만 JSON 으로 출력해라:
{ "index": ${nextIndex}, "title": "...", "entry": "...", "recap": "이전 화 요약", "nodes": [ ... ] }
`.trim();

  const attempt = await runAttempt<Episode>(opts, prompt, (data) => {
    const episode = toEpisode(data, nextIndex);
    if (!episode) return { ok: false, problems: ['nodes 또는 entry 가 없습니다'] };
    const problems = checkEpisode(episode, statNames);
    return problems.length > 0 ? { ok: false, problems } : { ok: true, value: episode };
  });

  return attempt.ok ? { episode: attempt.value } : { error: attempt.error };
}

// ── 공통 실행 (검증 → 1회 재시도) ────────────────────────────

/**
 * 검증 결과. `ok` 를 판별자로 둔 이유는 순전히 타입 추론 때문이다 —
 * 속성 존재 여부(`'value' in x`)로만 갈라 두면 제네릭 T 가 안정적으로 추론되지 않는다.
 */
type CheckResult<T> = { ok: true; value: T } | { ok: false; problems: string[] };

type Check<T> = (data: unknown) => CheckResult<T>;

async function runAttempt<T>(
  opts: GenerateOptions,
  prompt: string,
  check: Check<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: GenerateFailure }> {
  let sessionId: string | null = null;
  let lastRaw = '';

  for (let round = 0; round < 2; round += 1) {
    const result = await askOnce(
      opts.route,
      opts.settings,
      {
        prompt,
        system: SYSTEM,
        sessionId,
        maxTokens: 32_000,
        signal: opts.signal,
      },
      (_chunk, soFar) => opts.onProgress?.(soFar),
    );

    if (result.error) return { ok: false, error: { ...result.error, raw: result.text } };
    sessionId = result.sessionId;
    lastRaw = result.text;

    const data = extractJson(result.text);
    if (data === null) {
      prompt = 'JSON 을 읽을 수 없었다. 설명 없이 JSON 객체 하나만 다시 출력해라.';
      continue;
    }

    const checked = check(data);
    if (checked.ok) return checked;

    // 오류 목록을 그대로 돌려준다 — 무엇이 틀렸는지 알려주면 대체로 한 번에 고친다
    prompt = `다음 문제를 고쳐서 JSON 전체를 다시 출력해라:\n${checked.problems.map((p) => `- ${p}`).join('\n')}`;
    if (round === 1) {
      return {
        ok: false,
        error: {
          message: '초안이 검증을 통과하지 못했습니다.',
          hint: checked.problems.slice(0, 4).join(' / '),
          raw: lastRaw,
        },
      };
    }
  }

  return { ok: false, error: { message: '초안을 만들지 못했습니다.', hint: null, raw: lastRaw } };
}

// ── 프롬프트용 요약 ──────────────────────────────────────────

function collectCarried(work: Work): { flags: string[]; items: string[] } {
  const flags = new Set<string>();
  const items = new Set<string>();
  for (const episode of work.episodes) {
    for (const node of episode.nodes) {
      for (const choice of node.choices) {
        choice.effects?.flags?.forEach((f) => flags.add(f));
        choice.effects?.items?.forEach((i) => items.add(i));
        choice.outcomes?.forEach((o) => {
          o.effects?.flags?.forEach((f) => flags.add(f));
          o.effects?.items?.forEach((i) => items.add(i));
        });
      }
    }
  }
  return { flags: [...flags], items: [...items] };
}

/** 직전 화를 프롬프트에 넣을 만큼만 압축한다 — 전문을 넣으면 토큰만 쓴다 */
function summarize(episode: Episode | undefined): string {
  if (!episode) return '(없음)';
  const lines = [`${episode.index}화 ${episode.title}`];
  const entry = episode.nodes.find((n) => n.id === episode.entry);
  if (entry) lines.push(`시작: ${entry.text.slice(0, 120)}`);
  for (const node of episode.nodes) {
    if (node.ending) lines.push(`엔딩(${node.ending.kind}) ${node.ending.title}: ${node.ending.text.slice(0, 80)}`);
  }
  return lines.join('\n');
}
