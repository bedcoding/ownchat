'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { brandWork } from '@/lib/brand';
import {
  arriveAt,
  choose,
  findEpisode,
  findNode,
  hasNextEpisode,
  initialState,
  lockedReason,
  outcomeHint,
  resolveEnding,
} from '@/lib/engine';
import type { TourProbeDemo } from '@/lib/tour';
import type { Character, Outcome, PlayState, StoryNode, Work } from '@/lib/types';
import ProbePanel from './ProbePanel';

type Tab = 'scene' | 'dex' | 'record';

interface Props {
  work: Work;
  /** 관리자 미리보기에서는 저장하지 않는다 */
  persist?: (state: PlayState | null) => void;
  initial?: PlayState | null;
  initialTab?: Tab;
  onExit?: () => void;
  /** 실제 화면 위에 설명을 얹는 /tour 에서만 data-tour 표식을 노출한다 */
  tourMode?: boolean;
  /** 투어의 심문 예시는 네트워크를 호출하지 않는다 */
  demoProbe?: TourProbeDemo;
}

/**
 * 트리 러너 — 플레이어 런타임과 관리자 미리보기가 공유한다.
 *
 * **심문 노드(`node.probe`)가 없는 작품에서는 네트워크 호출이 한 줄도 없다** — 그 작품은
 * 비행기 모드에서 그대로 돈다. 심문 노드를 쓰는 작품만 그 노드에서 `ProbePanel` 이 모델을
 * 부르고, 그때도 요청은 사용자 기기에서 직접 나간다(이 사이트의 서버는 끼지 않는다).
 * 작품이 어느 쪽인지는 `requiresRuntimeAI()` 가 데이터에서 판정한다.
 */
export default function Runner({
  work: rawWork,
  persist,
  initial,
  initialTab = 'scene',
  onExit,
  tourMode = false,
  demoProbe,
}: Props) {
  /*
   * 화면에 그릴 때만 플랫폼 이름을 치환한다. 저작 도구가 들고 있는 원본은
   * 토큰(`{PLATFORM}`)을 유지해야 발행 JSON 에 실명이 새지 않는다.
   */
  const work = useMemo(() => brandWork(rawWork), [rawWork]);

  const [state, setState] = useState<PlayState>(() => {
    if (initial && initial.workId === work.id) return initial;
    const s = initialState(work);
    const ep = findEpisode(work, s.episodeIndex);
    const entry = ep ? findNode(ep, ep.entry) : undefined;
    return entry ? arriveAt(s, entry) : s;
  });
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    persist?.(state);
  }, [state, persist]);

  const episode = useMemo(() => findEpisode(work, state.episodeIndex), [work, state.episodeIndex]);
  const node: StoryNode | undefined = useMemo(
    () => (episode ? findNode(episode, state.nodeId) : undefined),
    [episode, state.nodeId],
  );

  /** 이 화의 첫 노드인가 — recap 표시 여부 */
  const atEpisodeStart = episode?.entry === state.nodeId;

  /** 직전 선택에서 굴린 결과 — 도착한 장면 위에 한 줄로 띄운다 */
  const rolled: string | undefined = state.log[state.log.length - 1]?.outcome;

  const pick = useCallback(
    (index: number) => {
      if (!node) return;
      const choice = node.choices[index];
      if (!choice) return;
      const outcome = choose(work, state, choice);
      if (outcome) setState(outcome.state);
    },
    [node, state, work],
  );

  const advance = useCallback(() => {
    if (!node?.ending) return;
    setState(resolveEnding(work, state, node));
  }, [node, state, work]);

  const restart = useCallback(() => {
    const s = initialState(work);
    const ep = findEpisode(work, s.episodeIndex);
    const entry = ep ? findNode(ep, ep.entry) : undefined;
    setState(entry ? arriveAt(s, entry) : s);
    setTab('scene');
  }, [work]);

  if (!episode || !node) {
    return (
      <div className="frame">
        <div className="empty-note">
          진행 지점을 찾을 수 없습니다. 트리가 수정되었을 수 있습니다.
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={restart}>
              처음부터
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="frame" data-tour={tourMode ? 'runner' : undefined}>
      <div className="topbar" data-tour={tourMode ? 'player-nav' : undefined}>
        {onExit ? (
          <button className="icon-btn" onClick={onExit}>
            ←
          </button>
        ) : null}
        <span className="title">{work.title}</span>
        <span className="ep">{episode.index}화</span>
        <span className="spacer" />
        <button className={`icon-btn${tab === 'dex' ? ' on' : ''}`} onClick={() => setTab(tab === 'dex' ? 'scene' : 'dex')}>
          도감
        </button>
        <button
          className={`icon-btn${tab === 'record' ? ' on' : ''}`}
          onClick={() => setTab(tab === 'record' ? 'scene' : 'record')}
        >
          기록
        </button>
      </div>

      {tab === 'dex' ? <Dex work={work} revealed={state.revealed} tourMode={tourMode} /> : null}
      {tab === 'record' ? <Record state={state} tourMode={tourMode} /> : null}

      {tab === 'scene' ? (
        node.ending ? (
          <EndingView
            work={work}
            state={state}
            node={node}
            onAdvance={advance}
            onRestart={restart}
          />
        ) : (
          <>
            <div className="scene" data-tour={tourMode ? 'scene' : undefined}>
              <SceneArt node={node} />
              {atEpisodeStart && episode.recap ? <div className="recap">{episode.recap}</div> : null}
              {rolled ? <div className="rolled">{rolled}</div> : null}
              <div className="scene-body">
                {node.speaker ? <div className="speaker">{node.speaker}</div> : null}
                <p className="narration">{node.text}</p>
              </div>
            </div>

            {node.probe ? (
              <ProbePanel
                node={node}
                state={state}
                onState={setState}
                demo={tourMode ? demoProbe : undefined}
                tourMode={tourMode}
              />
            ) : null}

            <div className="choices">
              {node.choices.map((choice, i) => {
                const locked = lockedReason(state, choice);
                const chance = outcomeHint(choice);
                return (
                  <button
                    key={`${choice.next}-${i}`}
                    className="choice"
                    data-tour={tourMode && i === 0 ? 'choices' : undefined}
                    disabled={locked !== null}
                    onClick={() => pick(i)}
                  >
                    {choice.label}
                    {/* 확률은 데이터에서 만든다 — 저작자가 라벨에 직접 쓰면 숫자를 고칠 때 어긋난다 */}
                    {chance ? <span className="chance">{chance}</span> : null}
                    {locked ? <span className="lock">{locked}</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        )
      ) : null}

      <Hud state={state} tourMode={tourMode} />
    </div>
  );
}

function SceneArt({ node }: { node: StoryNode }) {
  return (
    <div className={`scene-art${node.image ? '' : ' empty'}`}>
      {node.image ? (
        // 저작 시점에 넣은 컷. 데이터 URL이거나 로컬 경로라 next/image 최적화 대상이 아니다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={node.image} alt="" />
      ) : (
        <div className="placeholder">웹툰 컷</div>
      )}
    </div>
  );
}

function Hud({ state, tourMode = false }: { state: PlayState; tourMode?: boolean }) {
  const stats = Object.entries(state.stats);
  return (
    <div className="hud" data-tour={tourMode ? 'hud' : undefined}>
      {stats.map(([name, value]) => (
        <span className="stat" key={name}>
          {name}
          <b>{value}</b>
        </span>
      ))}
      {state.items.length > 0 ? <span className="items">소지품 · {state.items.join(', ')}</span> : null}
    </div>
  );
}

function EndingView({
  work,
  state,
  node,
  onAdvance,
  onRestart,
}: {
  work: Work;
  state: PlayState;
  node: StoryNode;
  onAdvance: () => void;
  onRestart: () => void;
}) {
  const ending = node.ending!;
  const label =
    ending.kind === 'advance' ? '다음 화로' : ending.kind === 'fail' ? '이 화 다시' : '처음부터';
  const kindText =
    ending.kind === 'advance' ? '목표 달성' : ending.kind === 'fail' ? '엔딩' : '완결';
  const isLastAdvance = ending.kind === 'advance' && !hasNextEpisode(work, state);

  return (
    <div className="ending">
      <div className="kind">{kindText}</div>
      <h2>{ending.title}</h2>
      <p>{ending.text}</p>
      {isLastAdvance ? (
        <>
          <p className="muted" style={{ fontSize: 13 }}>
            수록된 마지막 화입니다.
          </p>
          <button className="btn" onClick={onRestart}>
            처음부터
          </button>
        </>
      ) : (
        <button className="btn primary" onClick={ending.kind === 'final' ? onRestart : onAdvance}>
          {label}
        </button>
      )}
    </div>
  );
}

function Dex({
  work,
  revealed,
  tourMode = false,
}: {
  work: Work;
  revealed: string[];
  tourMode?: boolean;
}) {
  const seen = (c: Character) => revealed.includes(c.id);
  return (
    <div className="panel" data-tour={tourMode ? 'dex' : undefined}>
      <div className="dex">
        {work.characters.map((c) => (
          <div className={`dex-card${seen(c) ? '' : ' locked'}`} key={c.id}>
            <div className="bust" />
            <div className="name">{seen(c) ? c.name : '???'}</div>
            {seen(c) ? <div className="intro">{c.intro}</div> : null}
          </div>
        ))}
      </div>
      <p className="empty-note" style={{ paddingBottom: 0 }}>
        {revealed.length} / {work.characters.length} 명을 만났습니다
      </p>
    </div>
  );
}

function Record({ state, tourMode = false }: { state: PlayState; tourMode?: boolean }) {
  if (state.log.length === 0) {
    return <div className="panel" data-tour={tourMode ? 'record' : undefined}><div className="empty-note">아직 기록이 없습니다.</div></div>;
  }
  let lastEpisode = -1;
  return (
    <div className="panel" data-tour={tourMode ? 'record' : undefined}>
      <div className="record">
        {state.log.map((entry, i) => {
          const mark = entry.episodeIndex !== lastEpisode;
          lastEpisode = entry.episodeIndex;
          return (
            <div key={`${entry.nodeId}-${i}`}>
              {mark ? <div className="ep-mark">{entry.episodeIndex}화</div> : null}
              <div className="entry">
                {entry.speaker ? <div className="who">{entry.speaker}</div> : null}
                <div>{entry.text}</div>
                {entry.choice ? <div className="picked">→ {entry.choice}</div> : null}
                {entry.outcome ? <div className="picked rolled-log">{entry.outcome}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
      {state.endings.length > 0 ? (
        <>
          <div className="ep-mark" style={{ marginTop: 20 }}>수집한 엔딩</div>
          <div className="record">
            {state.endings.map((e, i) => (
              <div className="entry" key={i}>
                {e.episodeIndex}화 · {e.title}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
