'use client';

import { emptyChoice, formatList, parseList, prune } from '@/lib/authoring';
import { outcomeHint } from '@/lib/engine';
import { emptyBrief, sealBrief } from '@/lib/seal';
import type { Choice, Episode, Outcome, StoryNode, Work } from '@/lib/types';
import ProbeForm from './ProbeForm';

interface Props {
  work: Work;
  episode: Episode;
  node: StoryNode;
  onChange: (node: StoryNode) => void;
  onDelete: () => void;
  isEntry: boolean;
  onMakeEntry: () => void;
}

/**
 * 노드 하나를 편집하는 폼.
 *
 * 요구조건/효과는 표 형태 UI 대신 **스탯은 숫자 입력, 플래그·아이템은 콤마 한 줄**로 받는다.
 * AI가 생성한 초안을 사람이 고치는 도구라 입력 속도가 정확성만큼 중요하다.
 */
export default function NodeForm({ work, episode, node, onChange, onDelete, isEntry, onMakeEntry }: Props) {
  const statNames = Object.keys(work.stats);
  const set = (patch: Partial<StoryNode>) => onChange({ ...node, ...patch });

  const setChoice = (i: number, patch: Partial<Choice>) => {
    const choices = node.choices.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    set({ choices });
  };

  const setOutcome = (ci: number, oi: number, patch: Partial<Outcome>) => {
    const choice = node.choices[ci];
    const outcomes = (choice.outcomes ?? []).map((o, idx) => (idx === oi ? { ...o, ...patch } : o));
    setChoice(ci, { outcomes });
  };

  return (
    <div className="node-form">
      <div className="form-head">
        <code className="node-id">{node.id}</code>
        {isEntry ? (
          <span className="badge">시작 노드</span>
        ) : (
          <button className="mini" onClick={onMakeEntry}>
            시작 노드로
          </button>
        )}
        <span className="spacer" />
        <button className="mini danger" onClick={onDelete} disabled={isEntry}>
          삭제
        </button>
      </div>

      <label className="field">
        <span>화자 <em>(비우면 내레이션)</em></span>
        <input value={node.speaker ?? ''} onChange={(e) => set({ speaker: e.target.value || undefined })} />
      </label>

      <label className="field">
        <span>본문</span>
        <textarea rows={5} value={node.text} onChange={(e) => set({ text: e.target.value })} />
      </label>

      <label className="field">
        <span>장면 컷 경로 <em>(비우면 플레이스홀더)</em></span>
        <input value={node.image ?? ''} onChange={(e) => set({ image: e.target.value || undefined })} />
      </label>

      {work.characters.length > 0 ? (
        <div className="field">
          <span>여기서 해금되는 캐릭터</span>
          <div className="chips">
            {work.characters.map((c) => {
              const on = node.reveals?.includes(c.id) ?? false;
              return (
                <button
                  key={c.id}
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() => {
                    const cur = new Set(node.reveals ?? []);
                    if (on) cur.delete(c.id);
                    else cur.add(c.id);
                    set({ reveals: cur.size > 0 ? [...cur] : undefined });
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 엔딩 */}
      <div className="field">
        <span>엔딩</span>
        <select
          value={node.ending?.kind ?? ''}
          onChange={(e) => {
            const kind = e.target.value;
            if (!kind) return set({ ending: undefined });
            set({
              ending: {
                kind: kind as 'advance' | 'fail' | 'final',
                title: node.ending?.title ?? '',
                text: node.ending?.text ?? '',
              },
            });
          }}
        >
          <option value="">엔딩 아님 (선택지로 이어짐)</option>
          <option value="advance">advance (목표 달성, 다음 화로)</option>
          <option value="fail">fail (이 화 다시)</option>
          <option value="final">final (완결)</option>
        </select>
      </div>

      {node.ending ? (
        <>
          <label className="field">
            <span>엔딩 제목</span>
            <input
              value={node.ending.title}
              onChange={(e) => set({ ending: { ...node.ending!, title: e.target.value } })}
            />
          </label>
          <label className="field">
            <span>엔딩 본문</span>
            <textarea
              rows={2}
              value={node.ending.text}
              onChange={(e) => set({ ending: { ...node.ending!, text: e.target.value } })}
            />
          </label>
        </>
      ) : (
        <div className="field">
          <span>
            선택지
            <button
              className="mini"
              style={{ marginLeft: 8 }}
              onClick={() => set({ choices: [...node.choices, emptyChoice(episode.entry)] })}
            >
              + 추가
            </button>
          </span>

          {node.choices.length === 0 ? (
            <p className="hint-line">선택지도 엔딩도 없으면 플레이가 막힙니다.</p>
          ) : null}

          {node.choices.map((choice, i) => (
            <div className="choice-edit" key={i}>
              <div className="row">
                <input
                  className="grow"
                  placeholder="선택지 문구"
                  value={choice.label}
                  onChange={(e) => setChoice(i, { label: e.target.value })}
                />
                <select value={choice.next} onChange={(e) => setChoice(i, { next: e.target.value })}>
                  {episode.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      → {n.id}
                      {n.ending ? ` (${n.ending.kind})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="mini danger"
                  onClick={() => set({ choices: node.choices.filter((_, idx) => idx !== i) })}
                >
                  ×
                </button>
              </div>

              <div className="row wrap sub">
                <span className="tag">필요</span>
                {statNames.map((name) => (
                  <label className="num" key={name}>
                    {name}
                    <input
                      type="number"
                      value={choice.requires?.stats?.[name] ?? ''}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === '' ? undefined : Number(e.target.value);
                        const stats = { ...(choice.requires?.stats ?? {}) };
                        if (v === undefined) delete stats[name];
                        else stats[name] = v;
                        setChoice(i, { requires: prune({ ...choice.requires, stats: prune(stats) }) });
                      }}
                    />
                  </label>
                ))}
                <input
                  className="grow"
                  placeholder="필요 플래그 (콤마)"
                  value={formatList(choice.requires?.flags)}
                  onChange={(e) =>
                    setChoice(i, { requires: prune({ ...choice.requires, flags: parseList(e.target.value) }) })
                  }
                />
                <input
                  className="grow"
                  placeholder="없어야 할 플래그"
                  value={formatList(choice.requires?.notFlags)}
                  onChange={(e) =>
                    setChoice(i, { requires: prune({ ...choice.requires, notFlags: parseList(e.target.value) }) })
                  }
                />
                <input
                  className="grow"
                  placeholder="필요 아이템"
                  value={formatList(choice.requires?.items)}
                  onChange={(e) =>
                    setChoice(i, { requires: prune({ ...choice.requires, items: parseList(e.target.value) }) })
                  }
                />
              </div>

              <div className="row wrap sub">
                <span className="tag">효과</span>
                {statNames.map((name) => (
                  <label className="num" key={name}>
                    {name}
                    <input
                      type="number"
                      value={choice.effects?.stats?.[name] ?? ''}
                      placeholder="±"
                      onChange={(e) => {
                        const v = e.target.value === '' ? undefined : Number(e.target.value);
                        const stats = { ...(choice.effects?.stats ?? {}) };
                        if (v === undefined) delete stats[name];
                        else stats[name] = v;
                        setChoice(i, { effects: prune({ ...choice.effects, stats: prune(stats) }) });
                      }}
                    />
                  </label>
                ))}
                <input
                  className="grow"
                  placeholder="추가 플래그 (콤마)"
                  value={formatList(choice.effects?.flags)}
                  onChange={(e) =>
                    setChoice(i, { effects: prune({ ...choice.effects, flags: parseList(e.target.value) }) })
                  }
                />
                <input
                  className="grow"
                  placeholder="추가 아이템"
                  value={formatList(choice.effects?.items)}
                  onChange={(e) =>
                    setChoice(i, { effects: prune({ ...choice.effects, items: parseList(e.target.value) }) })
                  }
                />
              </div>

              <div className="row sub">
                <span className="tag">잠김 문구</span>
                <input
                  className="grow"
                  placeholder="비우면 요구조건에서 자동 생성"
                  value={choice.lockedHint ?? ''}
                  onChange={(e) => setChoice(i, { lockedHint: e.target.value || undefined })}
                />
              </div>

              {/*
                확률 분기. 확정 대가는 위의 "효과", 운에 달린 부분이 여기다.
                "도망친다: 돈 -1 확정, 30% 확률로 추격당함" 같은 선택지가 둘을 함께 쓴다.
              */}
              <div className="row wrap sub">
                <span className="tag">확률</span>
                {(choice.outcomes ?? []).length === 0 ? (
                  <>
                    <button
                      className="mini"
                      onClick={() => setChoice(i, { outcomes: [{ chance: 30 }] })}
                    >
                      + 확률 분기
                    </button>
                    <span className="hint-line" style={{ margin: 0 }}>
                      없으면 항상 같은 결과입니다
                    </span>
                  </>
                ) : (
                  <>
                    <span className="hint-line" style={{ margin: 0 }}>
                      {outcomeHint(choice)}
                    </span>
                    <span className="spacer" />
                    <button
                      className="mini"
                      onClick={() => setChoice(i, { outcomes: [...(choice.outcomes ?? []), { chance: 10 }] })}
                    >
                      + 분기
                    </button>
                  </>
                )}
              </div>

              {(choice.outcomes ?? []).map((outcome, oi) => (
                <div className="row wrap sub outcome-edit" key={oi}>
                  <label className="num">
                    %
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={outcome.chance}
                      onChange={(e) => setOutcome(i, oi, { chance: Number(e.target.value) })}
                    />
                  </label>
                  <input
                    className="grow"
                    placeholder="결과 문구 (주먹이 빗나갔다)"
                    value={outcome.text ?? ''}
                    onChange={(e) => setOutcome(i, oi, { text: e.target.value || undefined })}
                  />
                  {statNames.map((name) => (
                    <label className="num" key={name}>
                      {name}
                      <input
                        type="number"
                        placeholder="±"
                        value={outcome.effects?.stats?.[name] ?? ''}
                        onChange={(e) => {
                          const stats = { ...(outcome.effects?.stats ?? {}) };
                          if (e.target.value === '') delete stats[name];
                          else stats[name] = Number(e.target.value);
                          setOutcome(i, oi, { effects: prune({ ...outcome.effects, stats: prune(stats) }) });
                        }}
                      />
                    </label>
                  ))}
                  <select
                    value={outcome.next ?? ''}
                    onChange={(e) => setOutcome(i, oi, { next: e.target.value || undefined })}
                  >
                    <option value="">→ 기본 노드</option>
                    {episode.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        → {n.id}
                      </option>
                    ))}
                  </select>
                  <button
                    className="mini danger"
                    onClick={() =>
                      setChoice(i, {
                        outcomes: (choice.outcomes ?? []).filter((_, idx) => idx !== oi),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/*
        심문 노드. 대부분의 작품은 쓰지 않으므로 접힌 상태로 둔다 —
        이 노드를 하나라도 쓰면 작품이 "플레이 중 AI 필요"로 분류되고 오프라인 플레이가 깨진다.
      */}
      {node.ending ? null : node.probe ? (
        <ProbeForm
          work={work}
          probe={node.probe}
          onChange={(probe) => set({ probe })}
          onRemove={() => set({ probe: undefined })}
        />
      ) : (
        <div className="row sub" style={{ marginTop: 12 }}>
          <button
            className="mini"
            onClick={() =>
              set({ probe: { who: '', intro: '', sealed: sealBrief(emptyBrief()), maxTurns: 8 } })
            }
          >
            심문 노드로 전환
          </button>
          <span className="hint-line" style={{ margin: 0 }}>
            플레이어가 자유 질문을 하는 노드. 이 작품은 플레이 중 AI 가 필요해집니다
          </span>
        </div>
      )}
    </div>
  );
}
