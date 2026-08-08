'use client';

import { useState } from 'react';
import { hostedOpenAIAvailable, subscriptionPossible } from '@/lib/capabilities';
import { modelsForProvider, normalizeModel, type ModelId } from '@/lib/models';
import { isDesktop } from '@/lib/providers';
import type { BridgeHealth, ProviderMode, Settings } from '@/lib/types';
import LoginButton from './LoginButton';

interface Props {
  settings: Settings;
  health: BridgeHealth | null;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  onRecheck: () => void;
  onLoginStarted: () => void;
}

export default function SettingsPanel({
  settings,
  health,
  onChange,
  onClose,
  onRecheck,
  onLoginStarted,
}: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [checking, setChecking] = useState(false);
  // 데스크톱 앱은 메인 프로세스와 IPC로 붙으므로 브리지 주소도 페어링 코드도 없다.
  const desktop = isDesktop();
  // 폰·태블릿에서는 구독 경로가 존재할 수 없다. 고를 수 없는 선택지를 보여주지 않는다.
  const canUseSubscription = subscriptionPossible();
  const hosted = hostedOpenAIAvailable();

  const modes: { id: ProviderMode; label: string }[] = [
    ...(hosted ? [{ id: 'openai' as const, label: 'OpenAI 데모' }] : []),
    ...(!hosted && canUseSubscription ? [{ id: 'auto' as const, label: '자동' }] : []),
    ...(canUseSubscription
      ? [{ id: 'local' as const, label: desktop ? 'Claude 구독' : 'Claude 구독 (브리지)' }]
      : []),
    { id: 'apikey', label: 'Anthropic API 키' },
  ];

  const draftModelProvider = draft.mode === 'openai' || (draft.mode === 'auto' && hosted) ? 'openai' : 'claude';
  const draftModels = modelsForProvider(draftModelProvider);
  const showLocalSettings = draft.mode === 'local' || (!hosted && draft.mode === 'auto');

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setMode = (mode: ProviderMode) =>
    setDraft((current) => ({
      ...current,
      mode,
      model: normalizeModel(mode === 'openai' ? 'openai' : 'claude', current.model),
    }));

  const recheck = async () => {
    setChecking(true);
    // 저장 전이라도 지금 입력한 주소로 확인해 볼 수 있게 먼저 반영한다.
    onChange(draft);
    onRecheck();
    setTimeout(() => setChecking(false), 800);
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="설정"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel">
        <h2>설정</h2>
        <p className="panel-sub">
          {hosted
            ? 'OpenAI API 키는 서버 환경변수에만 있고 브라우저에는 전달되지 않습니다.'
            : `입력한 값은 이 ${desktop ? '기기' : '브라우저'}에만 저장됩니다.`}
        </p>

        <div className="field">
          <label>연결 방식</label>
          <div className="radio-row">
            {modes.map((mode) => (
              <label key={mode.id}>
                <input
                  type="radio"
                  name="mode"
                  // 폰에서 선택지가 하나뿐이면 저장된 값이 뭐든 그것으로 동작한다
                  checked={modes.length === 1 || draft.mode === mode.id || (hosted && draft.mode === 'auto' && mode.id === 'openai')}
                  onChange={() => setMode(mode.id)}
                />
                {mode.label}
              </label>
            ))}
          </div>
          <span className="desc">
            {hosted
              ? '공개 데모는 서버의 OpenAI 키를 사용합니다. 접근 코드는 API 키가 아닙니다.'
              : !canUseSubscription
                ? '이 기기에서는 API 키로만 쓸 수 있습니다.'
                : 'Claude 구독 또는 본인 API 키 경로를 고를 수 있습니다.'}
          </span>
        </div>

        {hosted ? (
          <div className="field">
            <label htmlFor="demoToken">데모 접근 코드</label>
            <input
              id="demoToken"
              type="password"
              value={draft.demoToken}
              onChange={(e) => set('demoToken', e.target.value.trim())}
              placeholder="공모전 안내에 적힌 코드"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="desc">브라우저에 저장되며 이 데모 서버의 요청 승인에만 사용됩니다.</span>
          </div>
        ) : null}

        {!showLocalSettings || desktop || !canUseSubscription ? null : (
          <div className="field">
            <label htmlFor="bridgeUrl">브리지 주소</label>
            <input
              id="bridgeUrl"
              type="text"
              value={draft.bridgeUrl}
              onChange={(e) => set('bridgeUrl', e.target.value)}
              placeholder="http://127.0.0.1:4319"
            />
            <span className="desc">
              터미널에서 <code>npx @ownchat/bridge</code> 를 실행하면 나오는 주소입니다.
            </span>
          </div>
        )}

        {/* 구독 경로가 불가능한 기기에서는 Claude Code 상태를 보여줄 이유가 없다 */}
        {!showLocalSettings || !canUseSubscription ? null : (
        <p className="status-line">
          {!health
            ? desktop
              ? 'Claude Code 상태를 확인하지 못했습니다.'
              : '브리지를 찾지 못했습니다. 터미널에서 `npx @ownchat/bridge` 를 실행하세요.'
            : !health.claudeCli.found
              ? 'Claude Code가 설치되어 있지 않습니다. `npm i -g @anthropic-ai/claude-code`'
              : health.claudeCli.loggedIn === false
                ? `Claude Code ${health.claudeCli.version} · 로그인 필요`
                : `Claude Code ${health.claudeCli.version} · 로그인됨${
                    health.claudeCli.authMethod ? ` (${health.claudeCli.authMethod})` : ''
                  }`}{' '}
          <button type="button" className="btn ghost" onClick={recheck} disabled={checking}>
            {checking ? '확인 중…' : '다시 확인'}
          </button>
        </p>
        )}

        {showLocalSettings && health?.claudeCli.found && health.claudeCli.loggedIn === false ? (
          <div className="field">
            <label>Claude 로그인</label>
            <div>
              <LoginButton
                settings={{ ...draft, bridgeToken: draft.bridgeToken || settings.bridgeToken }}
                onStarted={onLoginStarted}
              />
            </div>
            <span className="desc">
              {desktop
                ? '버튼을 누르면 브라우저에 로그인 창이 열립니다. 코드는 이 앱 안에서 공식 Claude Code에 그대로 전달되고, 어디에도 저장되지 않습니다.'
                : '버튼을 누르면 브라우저에 로그인 창이 열립니다. 코드 입력은 브리지가 직접 띄우는 로컬 페이지에서 처리되고, 이 사이트는 그 값을 보지 않습니다.'}
            </span>
          </div>
        ) : null}

        {!showLocalSettings || desktop || !canUseSubscription ? null : (
          <div className="field">
            <label htmlFor="bridgeToken">페어링 코드</label>
            <input
              id="bridgeToken"
              type="text"
              value={draft.bridgeToken}
              onChange={(e) => set('bridgeToken', e.target.value.replace(/\s+/g, ''))}
              placeholder="브리지 터미널에 찍힌 코드"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="desc">공백은 자동으로 지워집니다. 이 코드가 없으면 브리지는 요청을 받지 않습니다.</span>
          </div>
        )}

        {draft.mode === 'apikey' || (!hosted && draft.mode === 'auto') ? <div className="field">
          {/* 구독 경로가 없는 기기에서는 선택이 아니라 유일한 방법이다 */}
          <label htmlFor="apiKey">Anthropic API 키{canUseSubscription ? ' (선택)' : ''}</label>
          <input
            id="apiKey"
            type="password"
            value={draft.apiKey}
            onChange={(e) => set('apiKey', e.target.value.trim())}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
          />
          <span className="desc">
            구독 경로를 못 쓸 때의 대안입니다. console.anthropic.com에서 발급하며, 사용한 토큰만큼 본인에게
            청구됩니다.
          </span>
        </div> : null}

        <div className="field">
          <label htmlFor="model">기본 모델</label>
          <select id="model" value={draft.model} onChange={(e) => set('model', e.target.value as ModelId)}>
            {draftModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.note}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={draft.showThinking}
              onChange={(e) => set('showThinking', e.target.checked)}
            />{' '}
            사고 과정 요약 보기
          </label>
          <span className="desc">모델이 답을 만들기 전에 정리한 내용을 대화창에 함께 표시합니다.</span>
        </div>

        <div className="panel-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onChange(draft);
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
