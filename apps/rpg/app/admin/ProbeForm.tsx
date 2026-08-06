'use client';

import { useMemo } from 'react';
import { formatList, parseList, prune } from '@/lib/authoring';
import { emptyBrief, sealBrief, unsealBrief } from '@/lib/seal';
import type { Probe, ProbeBrief, ProbeUnlock, Work } from '@/lib/types';

/**
 * 심문 노드 편집기.
 *
 * **대부분의 작품은 이걸 쓰지 않는다.** 심문 노드는 플레이 중에 AI 가 도는 유일한 자리이고,
 * 그 노드를 하나라도 쓰면 작품이 "AI 필요"로 분류된다(오프라인 플레이가 깨진다).
 * 그래서 노드 폼에서 기본으로 접혀 있고, 여기까지 온 사람만 쓴다.
 *
 * 진상(persona·knows·withholds·unlocks)은 `sealed` 안에 봉인해 저장한다. 편집할 때만 풀고,
 * 발행 JSON 에는 봉인된 형태로 들어간다 — 개발자 도구로 범인 이름이 그냥 읽히는 것을 막는다.
 * 작정하고 뜯으면 복원되고, 그건 서버를 두지 않기로 한 대가다(`lib/seal.ts` 참고).
 */

interface Props {
  work: Work;
  probe: Probe;
  onChange: (probe: Probe) => void;
  onRemove: () => void;
}

export default function ProbeForm({ work, probe, onChange, onRemove }: Props) {
  const brief = useMemo(() => unsealBrief(probe.sealed) ?? emptyBrief(), [probe.sealed]);
  const broken = unsealBrief(probe.sealed) === null;
  const statNames = Object.keys(work.stats);

  const setBrief = (patch: Partial<ProbeBrief>) => {
    onChange({ ...probe, sealed: sealBrief({ ...brief, ...patch }) });
  };

  const setUnlock = (i: number, patch: Partial<ProbeUnlock>) => {
    const unlocks = (brief.unlocks ?? []).map((u, idx) => (idx === i ? { ...u, ...patch } : u));
    setBrief({ unlocks });
  };

  return (
    <div className="probe-form">
      <div className="form-head">
        <span className="badge warn">심문 노드 · 플레이 중 AI 필요</span>
        <span className="spacer" />
        <button className="mini danger" onClick={onRemove}>
          심문 해제
        </button>
      </div>

      {broken ? (
        <div className="notice bad">
          심문 설정을 읽을 수 없습니다 (봉인 손상). 아래에 다시 입력하면 새로 봉인됩니다.
        </div>
      ) : null}

      <p className="hint-line">
        플레이어가 이 인물에게 자유롭게 질문합니다. 답변은 모델이 만들고, <b>상태 변화는 아래 해금 규칙이
        결정합니다</b> — 모델에게 아이템을 줄 권한을 주지 않기 때문에 프롬프트로 게임을 깰 수 없습니다.
      </p>

      <div className="row wrap">
        <label className="field inline grow">
          <span>심문 상대</span>
          <input
            value={probe.who}
            placeholder="집사"
            onChange={(e) => onChange({ ...probe, who: e.target.value })}
          />
        </label>
        <label className="field inline">
          <span>질문 횟수 제한</span>
          <input
            type="number"
            min={1}
            value={probe.maxTurns ?? ''}
            placeholder="무제한"
            onChange={(e) =>
              onChange({ ...probe, maxTurns: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </label>
      </div>
      {probe.maxTurns ? null : (
        <p className="hint-line">
          횟수를 정하는 편이 좋습니다 — 토큰을 쓰는 쪽은 플레이어 본인입니다.
        </p>
      )}

      <label className="field">
        <span>
          심문 화면 안내 <em>(플레이어가 봅니다)</em>
        </span>
        <input
          value={probe.intro}
          placeholder="집사는 문 앞에 서 있다. 무엇이든 물어볼 수 있다."
          onChange={(e) => onChange({ ...probe, intro: e.target.value })}
        />
      </label>

      <div className="section">
        <h3>
          진상 <em>(봉인되어 저장됩니다)</em>
        </h3>

        <label className="field">
          <span>이 인물은 누구이고 어떤 태도인가</span>
          <textarea
            rows={3}
            value={brief.persona}
            placeholder="30년을 이 집에서 일한 집사. 주인을 감싸려 하고, 자기 알리바이에는 거짓이 섞여 있다."
            onChange={(e) => setBrief({ persona: e.target.value })}
          />
        </label>

        <label className="field">
          <span>
            물으면 말해도 되는 것 <em>(한 줄에 하나)</em>
          </span>
          <textarea
            rows={4}
            value={(brief.knows ?? []).join('\n')}
            placeholder={'9시에 서재 불이 꺼져 있었다\n부인이 그날 밤 외출했다'}
            onChange={(e) => setBrief({ knows: e.target.value.split('\n').filter((s) => s.trim()) })}
          />
        </label>

        <label className="field">
          <span>
            절대 말하면 안 되는 것 <em>(한 줄에 하나)</em>
          </span>
          <textarea
            rows={3}
            value={(brief.withholds ?? []).join('\n')}
            placeholder={'자신이 유언장을 미리 봤다는 사실\n범인의 이름'}
            onChange={(e) => setBrief({ withholds: e.target.value.split('\n').filter((s) => s.trim()) })}
          />
        </label>
      </div>

      <div className="section">
        <h3>
          해금 규칙
          <button
            className="mini"
            onClick={() =>
              setBrief({ unlocks: [...(brief.unlocks ?? []), { when: [], effects: {}, notice: '' }] })
            }
          >
            + 추가
          </button>
        </h3>
        <p className="hint-line">
          답변에 <b>어떤 문구가 나타나면</b> 무엇을 줄지 정합니다. 판정은 문구 포함 여부로만 하므로,
          인물이 실제로 말할 표현을 넣으세요.
        </p>

        {(brief.unlocks ?? []).length === 0 ? (
          <p className="hint-line">
            해금 규칙이 없으면 심문은 분위기만 만들고 진행에 영향을 주지 않습니다.
          </p>
        ) : null}

        {(brief.unlocks ?? []).map((unlock, i) => (
          <div className="choice-edit" key={i}>
            <div className="row">
              <input
                className="grow"
                placeholder="이 문구가 나오면 (콤마로 여러 개)"
                value={formatList(unlock.when)}
                onChange={(e) => setUnlock(i, { when: parseList(e.target.value) })}
              />
              <button
                className="mini danger"
                onClick={() => setBrief({ unlocks: (brief.unlocks ?? []).filter((_, idx) => idx !== i) })}
              >
                ×
              </button>
            </div>
            <div className="row sub">
              <span className="tag">알림</span>
              <input
                className="grow"
                placeholder="메모의 필적이 집사의 것이라는 걸 알아냈다"
                value={unlock.notice}
                onChange={(e) => setUnlock(i, { notice: e.target.value })}
              />
            </div>
            <div className="row wrap sub">
              <span className="tag">주는 것</span>
              {statNames.map((name) => (
                <label className="num" key={name}>
                  {name}
                  <input
                    type="number"
                    placeholder="±"
                    value={unlock.effects.stats?.[name] ?? ''}
                    onChange={(e) => {
                      const stats = { ...(unlock.effects.stats ?? {}) };
                      if (e.target.value === '') delete stats[name];
                      else stats[name] = Number(e.target.value);
                      setUnlock(i, { effects: prune({ ...unlock.effects, stats: prune(stats) }) ?? {} });
                    }}
                  />
                </label>
              ))}
              <input
                className="grow"
                placeholder="플래그 (콤마)"
                value={formatList(unlock.effects.flags)}
                onChange={(e) =>
                  setUnlock(i, { effects: prune({ ...unlock.effects, flags: parseList(e.target.value) }) ?? {} })
                }
              />
              <input
                className="grow"
                placeholder="아이템 (콤마)"
                value={formatList(unlock.effects.items)}
                onChange={(e) =>
                  setUnlock(i, { effects: prune({ ...unlock.effects, items: parseList(e.target.value) }) ?? {} })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
