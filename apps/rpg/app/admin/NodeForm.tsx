'use client';

import { emptyChoice, formatList, parseList, prune } from '@/lib/authoring';
import type { Choice, Episode, StoryNode, Work } from '@/lib/types';

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
