'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { probeBridge, resolveRoute, type Resolution } from '@/lib/ai/client';
import { generateEpisodeDraft, generateWorkDraft, type GenerateFailure } from '@/lib/ai/generate';
import { DEFAULT_MODEL, loadSettings, saveSettings } from '@/lib/ai/settings';
import type { AiSettings, BridgeHealth } from '@/lib/ai/types';
import { newId } from '@/lib/authoring';
import type { Episode, Work } from '@/lib/types';

/**
 * 관리자 저작 도구의 AI 패널.
 *
 * 이 화면이 이 프로젝트에서 AI 가 도는 유일한 자리다(심문 노드를 쓰지 않는 작품에서는).
 * 플레이어 쪽에는 여기서 발행한 JSON 만 내려간다.
 */

const MODELS = [
  { id: 'claude-opus-5', label: 'Opus 5', note: '기본값. 구조가 복잡한 트리에 강함' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', note: '빠르고 저렴. 초안 다듬기용' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: '가장 빠름. 짧은 회차 실험용' },
  { id: 'claude-fable-5', label: 'Fable 5', note: '최고 성능. 단가가 가장 높음' },
];

interface Props {
  /** 열려 있는 작품 — 없으면 "새 작품 만들기" 모드 */
  work: Work | null;
  onNewWork: (draft: Work) => void;
  onAddEpisode: (episode: Episode) => void;
  onClose: () => void;
}

export default function AiPanel({ work, onNewWork, onAddEpisode, onClose }: Props) {
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings());
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [checking, setChecking] = useState(true);
  const [brief, setBrief] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [failure, setFailure] = useState<GenerateFailure | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void probeBridge(settings).then((h) => {
      if (!alive) return;
      setHealth(h);
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [settings]);

  // 화면을 떠날 때 진행 중인 요청을 끊는다 — 브리지가 종료를 감지해 claude 프로세스를 정리한다
  useEffect(() => () => abortRef.current?.abort(), []);

  const update = useCallback((patch: Partial<AiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resolution: Resolution = resolveRoute(settings, health);

  const run = useCallback(async () => {
    if (!resolution.route || !brief.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress('');
    setFailure(null);
    setShowRaw(false);

    const common = {
      route: resolution.route,
      settings,
      brief,
      signal: controller.signal,
      onProgress: setProgress,
    };

    try {
      if (work) {
        const result = await generateEpisodeDraft({ ...common, work });
        if ('error' in result) setFailure(result.error);
        else {
          onAddEpisode(result.episode);
          setBrief('');
        }
      } else {
        const result = await generateWorkDraft(common);
        if ('error' in result) setFailure(result.error);
        else {
          const { draft } = result;
          onNewWork({
            id: newId('w'),
            title: draft.title,
            rating: draft.rating,
            stats: draft.stats,
            characters: draft.characters,
            episodes: [draft.episode],
          });
        }
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [brief, onAddEpisode, onNewWork, resolution.route, settings, work]);

  const nextIndex = work ? Math.max(0, ...work.episodes.map((e) => e.index)) + 1 : 1;

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <strong>{work ? `${nextIndex}화 초안 생성` : '새 작품 초안 생성'}</strong>
        <span className="spacer" />
        <button className="mini" onClick={onClose} disabled={running}>
          닫기
        </button>
      </div>

      <RouteStatus checking={checking} resolution={resolution} />

      <label className="field">
        <span>
          {work ? '이 화에서 무엇이 일어나는지' : '작품 설정'}{' '}
          <em>{work ? '(비우면 앞 화에서 이어감)' : '(한 줄이면 충분합니다)'}</em>
        </span>
        <textarea
          rows={4}
          value={brief}
          placeholder={
            work
              ? '예) 주인공이 빚쟁이를 피해 항구로 도망친다. 배를 타려면 통행증이 필요하다.'
              : '예) 낡은 아파트에 강도가 든다. 주인공은 혼자 있고, 무기는 부엌칼뿐이다.'
          }
          onChange={(e) => setBrief(e.target.value)}
          disabled={running}
        />
      </label>

      <div className="row wrap">
        <label className="field inline">
          <span>모델</span>
          <select value={settings.model} onChange={(e) => update({ model: e.target.value })} disabled={running}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <span className="hint-line">{MODELS.find((m) => m.id === settings.model)?.note}</span>
        <span className="spacer" />
        <button className="mini primary" onClick={() => void run()} disabled={running || !resolution.route || !brief.trim()}>
          {running ? '생성 중…' : '초안 생성'}
        </button>
        {running ? (
          <button className="mini" onClick={() => abortRef.current?.abort()}>
            중단
          </button>
        ) : null}
      </div>

      <Connection settings={settings} onChange={update} resolution={resolution} disabled={running} />

      {running ? (
        <div className="ai-progress">
          <div className="ai-progress-bar" />
          <pre>{progress.slice(-1200) || '모델을 기다리는 중…'}</pre>
        </div>
      ) : null}

      {failure ? (
        <div className="notice bad">
          <strong>{failure.message}</strong>
          {failure.hint ? <div className="hint-line">{failure.hint}</div> : null}
          {failure.raw ? (
            <>
              <button className="mini" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? '원본 숨기기' : '모델이 뱉은 내용 보기'}
              </button>
              {showRaw ? <pre className="ai-raw">{failure.raw.slice(0, 4000)}</pre> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RouteStatus({ checking, resolution }: { checking: boolean; resolution: Resolution }) {
  if (checking) return <div className="hint-line">경로를 확인하는 중…</div>;

  const help: Record<string, string> = {
    need_bridge: '터미널에서 `npm run bridge` 를 실행하면 페어링 코드가 찍힙니다. 또는 아래에 API 키를 넣으세요.',
    need_token: '브리지를 켤 때 찍힌 페어링 코드를 아래에 붙여넣으세요.',
    need_cli: '`npm i -g @anthropic-ai/claude-code` 로 설치한 뒤 한 번 실행해 로그인하세요.',
    need_login: 'Claude Code 에 로그인이 필요합니다.',
    need_key: 'console.anthropic.com 에서 발급한 본인 키를 아래에 넣으세요.',
  };

  return (
    <div className={`notice${resolution.route ? '' : ' bad'}`}>
      {resolution.reason}
      {resolution.blocking ? <div className="hint-line">{help[resolution.blocking]}</div> : null}
    </div>
  );
}

/**
 * 접속 설정. 필요한 것만 펼쳐 보여준다 —
 * 브리지가 이미 붙어 있으면 관리자는 이걸 열 이유가 없다.
 */
function Connection({
  settings,
  onChange,
  resolution,
  disabled,
}: {
  settings: AiSettings;
  onChange: (patch: Partial<AiSettings>) => void;
  resolution: Resolution;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const needsAttention = resolution.route === null;

  if (!open && !needsAttention) {
    return (
      <button className="mini" onClick={() => setOpen(true)}>
        접속 설정
      </button>
    );
  }

  return (
    <div className="section">
      <h3>
        접속 설정
        {needsAttention ? null : (
          <button className="mini" onClick={() => setOpen(false)}>
            접기
          </button>
        )}
      </h3>
      <p className="hint-line">
        여기 넣은 값은 이 브라우저에만 저장되고 어디로도 전송되지 않습니다. 구독 경로(브리지)가 있으면 추가 과금이 없습니다.
      </p>
      <div className="row wrap">
        <label className="field inline grow">
          <span>브리지 주소</span>
          <input value={settings.bridgeUrl} onChange={(e) => onChange({ bridgeUrl: e.target.value })} disabled={disabled} />
        </label>
        <label className="field inline grow">
          <span>페어링 코드</span>
          <input
            type="password"
            value={settings.bridgeToken}
            placeholder="npm run bridge 실행 시 출력"
            onChange={(e) => onChange({ bridgeToken: e.target.value })}
            disabled={disabled}
          />
        </label>
      </div>
      <label className="field">
        <span>
          본인 API 키 <em>(브리지를 못 쓸 때만. 사용량만큼 과금)</em>
        </span>
        <input
          type="password"
          value={settings.apiKey}
          placeholder="sk-ant-…"
          onChange={(e) => onChange({ apiKey: e.target.value })}
          disabled={disabled}
        />
      </label>
      {settings.model !== DEFAULT_MODEL ? (
        <button className="mini" onClick={() => onChange({ model: DEFAULT_MODEL })} disabled={disabled}>
          모델을 기본값으로
        </button>
      ) : null}
    </div>
  );
}
