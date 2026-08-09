'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { probeBridge, resolveRoute, type Resolution } from '@/lib/ai/client';
import { askProbe } from '@/lib/ai/probe';
import { loadSettings, saveSettings } from '@/lib/ai/settings';
import type { AiSettings, AiTurn, BridgeHealth } from '@/lib/ai/types';
import { applyProbeReply, probeTurnsLeft } from '@/lib/engine';
import type { TourProbeDemo, TourProbeEntry } from '@/lib/tour';
import type { PlayState, StoryNode } from '@/lib/types';

/**
 * 심문 화면 — 이 게임에서 플레이어 쪽 AI 가 도는 유일한 자리.
 *
 * 이 패널이 붙은 노드에서도 **선택지는 그대로 있다.** 심문을 건너뛰고 진행할 수 있어야
 * AI 를 못 쓰는 기기에서도 작품이 막히지 않는다.
 *
 * 추론 비용은 사용자 쪽에서 발생한다 — PC 라면 본인 Claude 구독(로컬 브리지), 폰이라면 본인 API 키.
 * 이 저장소의 서버는 어느 경로에도 끼지 않는다.
 */

interface Props {
  node: StoryNode;
  state: PlayState;
  onState: (next: PlayState) => void;
  demo?: TourProbeDemo;
  tourMode?: boolean;
}

export default function ProbePanel({ node, state, onState, demo, tourMode = false }: Props) {
  const probe = node.probe!;
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings());
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [checking, setChecking] = useState(!demo);
  const [log, setLog] = useState<TourProbeEntry[]>(() => demo?.log ?? []);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (demo) {
      setChecking(false);
      return;
    }
    let alive = true;
    void probeBridge(settings).then((h) => {
      if (!alive) return;
      setHealth(h);
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [settings, demo]);

  // 노드를 떠나면 대화를 버린다. 얻은 것(플래그·아이템)만 상태에 남는다.
  useEffect(() => {
    setLog(demo?.log ?? []);
    sessionRef.current = null;
    return () => abortRef.current?.abort();
  }, [node.id, demo]);

  const update = useCallback((patch: Partial<AiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resolution: Resolution = resolveRoute(settings, health);
  const left = probeTurnsLeft(state, node);
  const exhausted = left !== null && left <= 0;

  const send = useCallback(async () => {
    const text = question.trim();
    if (!text || busy || exhausted || (!demo && !resolution.route)) return;

    if (demo) {
      setQuestion('');
      setLog((prev) => [
        ...prev,
        { role: 'user', text },
        { role: 'assistant', text: demo.reply },
      ]);
      return;
    }

    if (!resolution.route) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setFailure(null);
    setPending('');
    setQuestion('');
    setLog((prev) => [...prev, { role: 'user', text }]);

    const history: AiTurn[] = log.map((e) => ({ role: e.role, text: e.text }));

    const reply = await askProbe({
      route: resolution.route,
      settings,
      node,
      history,
      sessionId: sessionRef.current,
      question: text,
      signal: controller.signal,
      onDelta: setPending,
    });

    setPending('');
    abortRef.current = null;
    setBusy(false);

    if (reply.error) {
      setFailure([reply.error.message, reply.error.hint].filter(Boolean).join(' '));
      // 실패한 질문은 이력에서 뺀다 — 다음 요청에 깨진 맥락을 보내지 않기 위해
      setLog((prev) => prev.slice(0, -1));
      return;
    }

    sessionRef.current = reply.sessionId;

    /*
     * 질문 횟수는 성공한 요청에만 센다. 그리고 해금 판정은 여기서 — 모델이 아니라
     * 엔진이 응답 텍스트를 보고 결정한다.
     */
    let next = { ...state };
    next.probeTurns = { ...(next.probeTurns ?? {}), [node.id]: (next.probeTurns?.[node.id] ?? 0) + 1 };

    const gains = applyProbeReply(next, node, reply.answer);
    if (gains.length > 0) next = gains[gains.length - 1].state;

    onState(next);
    setLog((prev) => [
      ...prev,
      { role: 'assistant', text: reply.answer, gains: gains.map((g) => g.notice) },
    ]);
  }, [busy, demo, exhausted, log, node, onState, question, resolution.route, settings, state]);

  return (
    <div className="probe">
      <div className="probe-head" data-tour={tourMode ? 'probe' : undefined}>
        <span className="who">{probe.who || '심문'}</span>
        {left !== null ? <span className="left">질문 {left}회 남음</span> : null}
      </div>

      {demo ? <div className="probe-demo-note">둘러보기용 예시 대화 · API를 호출하지 않습니다</div> : null}

      {probe.intro ? <p className="probe-intro">{probe.intro}</p> : null}

      {log.length > 0 ? (
        <div className="probe-log">
          {log.map((entry, i) => (
            <div className={`probe-line ${entry.role}`} key={i}>
              <p>{entry.text}</p>
              {entry.gains?.map((notice, gi) => (
                <div className="probe-gain" key={gi}>
                  ✦ {notice}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {busy ? (
        <div className="probe-line assistant pending">
          <p>{pending || '…'}</p>
        </div>
      ) : null}

      {failure ? <div className="probe-error">{failure}</div> : null}

      {checking ? (
        <p className="hint-line">연결을 확인하는 중…</p>
      ) : (resolution.route || Boolean(demo)) && !exhausted ? (
        <div className="probe-input">
          <input
            value={question}
            placeholder={`${probe.who || '상대'}에게 물어볼 것`}
            disabled={busy}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
            }}
          />
          <button className="btn" onClick={() => void send()} disabled={busy || !question.trim()}>
            묻기
          </button>
        </div>
      ) : exhausted ? (
        <p className="hint-line">더 물어볼 수 없습니다. 아래에서 선택하세요.</p>
      ) : (
        <ProbeSetup
          resolution={resolution}
          settings={settings}
          onChange={update}
          open={showSetup}
          onToggle={() => setShowSetup((v) => !v)}
        />
      )}
    </div>
  );
}

/**
 * AI 경로가 없을 때의 안내.
 *
 * 여기서 막혀도 아래 선택지로 진행할 수 있다는 점을 분명히 말한다 — 이 게임은 심문을
 * 하지 않아도 완주할 수 있게 설계하도록 되어 있다.
 */
function ProbeSetup({
  resolution,
  settings,
  onChange,
  open,
  onToggle,
}: {
  resolution: Resolution;
  settings: AiSettings;
  onChange: (patch: Partial<AiSettings>) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="probe-setup">
      <p>
        이 장면에서는 직접 물어볼 수 있습니다. 추론은 <b>내 기기에서</b> 처리되고, 이 사이트의 서버는
        대화에 끼지 않습니다. 설정하지 않아도 아래 선택지로 진행할 수 있습니다.
      </p>
      <p className="hint-line">{resolution.reason}</p>
      <button className="mini" onClick={onToggle}>
        {open ? '접기' : '설정하기'}
      </button>
      {open ? (
        <>
          <label className="field">
            <span>
              본인 API 키 <em>(console.anthropic.com · 사용량만큼 과금)</em>
            </span>
            <input
              type="password"
              value={settings.apiKey}
              placeholder="sk-ant-…"
              onChange={(e) => onChange({ apiKey: e.target.value })}
            />
          </label>
          <p className="hint-line">
            PC 에서 본인 Claude 구독으로 쓰려면 터미널에서 <code>npx @ownchat/bridge</code> 를 띄우고
            페어링 코드를 넣으세요.
          </p>
          <div className="row wrap">
            <label className="field inline grow">
              <span>브리지 주소</span>
              <input value={settings.bridgeUrl} onChange={(e) => onChange({ bridgeUrl: e.target.value })} />
            </label>
            <label className="field inline grow">
              <span>페어링 코드</span>
              <input
                type="password"
                value={settings.bridgeToken}
                onChange={(e) => onChange({ bridgeToken: e.target.value })}
              />
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
