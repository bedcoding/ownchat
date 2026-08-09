'use client';

import { useCallback, useEffect, useState } from 'react';
import { desktopApi, startLocalLogin } from '@/lib/chat/providers';
import type { Settings } from '@/lib/chat/types';

interface Props {
  settings: Settings;
  /** 로그인 창을 띄운 직후 — 부모가 상태 폴링을 빠르게 돌리도록 알린다 */
  onStarted: () => void;
  label?: string;
}

/**
 * 버튼 하나로 공식 CLI의 로그인 흐름을 띄운다. 실행 환경에 따라 코드 입력 위치가 다르다.
 *
 * - 데스크톱 앱: 앱 안에서 받는다. 렌더러는 서명된 로컬 파일만 로드하고 원격 콘텐츠를
 *   불러오지 않으므로(엄격한 CSP), 이 코드가 지나갈 수 있는 외부 오리진이 없다.
 * - 호스팅 웹: 브리지가 127.0.0.1에서 직접 띄우는 페이지에서 받는다. 그 코드는 계정
 *   접근으로 교환되는 값이라, 호스팅 도메인의 자바스크립트가 볼 수 없는 곳에서 처리한다.
 */
export default function LoginButton({ settings, onStarted, label = 'Claude 로그인' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ url: string | null; fallbackCommand?: string } | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const api = desktopApi();
  const needsToken = !api && !settings.bridgeToken;

  const click = async () => {
    setBusy(true);
    setError(null);
    const result = await startLocalLogin(settings);
    setBusy(false);
    onStarted();

    if (!result.ok) {
      setError(result.message ?? '로그인을 시작하지 못했습니다.');
      return;
    }

    if (result.inApp) {
      const state = await api?.loginState();
      setDialog({ url: state?.url ?? null });
      return;
    }

    if (!result.pageUrl) {
      setError('코드 입력 페이지 주소를 받지 못했습니다.');
      return;
    }
    // 팝업이 차단되면 window.open이 null을 준다. 그때는 주소를 직접 안내한다.
    const opened = window.open(result.pageUrl, 'ownchat-login', 'width=560,height=640');
    if (!opened) setError(`팝업이 차단됐습니다. 새 탭에서 ${result.pageUrl} 를 여세요.`);
  };

  // 앱 안 로그인 대화상자가 열려 있는 동안 완료 여부를 확인한다.
  useEffect(() => {
    if (!dialog || !api) return;
    const timer = setInterval(async () => {
      const state = await api.loginState();
      if (state.loggedIn) {
        setDialog(null);
        setCode('');
      } else if (state.state === 'error') {
        setError(state.error ?? '로그인에 실패했습니다.');
        setDialog(null);
      } else if (state.url && !dialog.url) {
        setDialog({ ...dialog, url: state.url });
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [dialog, api]);

  const submit = useCallback(async () => {
    if (!api) return;
    const clean = code.trim();
    if (!clean) return;
    setSubmitting(true);
    setError(null);
    const result = await api.submitLoginCode(clean);
    setSubmitting(false);
    if (!result.ok) setError(result.message ?? '코드를 전달하지 못했습니다.');
  }, [api, code]);

  const close = () => {
    void api?.cancelLogin();
    setDialog(null);
    setCode('');
  };

  return (
    <span>
      <button type="button" className="btn primary" onClick={click} disabled={busy || needsToken}>
        {busy ? '여는 중…' : label}
      </button>
      {needsToken ? <span className="desc"> 페어링 코드를 먼저 입력하세요.</span> : null}
      {error ? <span className="desc" style={{ color: 'var(--err)' }}> {error}</span> : null}

      {dialog ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Claude 로그인">
          <div className="panel">
            <h2>Claude 로그인</h2>
            <p className="panel-sub">
              브라우저가 열렸습니다. 로그인이 끝나면 화면에 나오는 <b>코드</b>를 여기에 붙여넣으세요.
            </p>

            {dialog.url ? (
              <p className="field">
                <button type="button" className="btn" onClick={() => void api?.openExternal(dialog.url as string)}>
                  브라우저가 안 열렸다면 여기를 누르세요
                </button>
              </p>
            ) : null}

            <div className="field">
              <label htmlFor="login-code">인증 코드</label>
              <input
                id="login-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="브라우저에 표시된 코드"
                autoComplete="off"
                spellCheck={false}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- 이 대화상자의 유일한 입력란
                autoFocus
              />
              <span className="desc">
                이 코드는 이 컴퓨터 안에서 공식 Claude Code에 그대로 전달됩니다. 저장하지 않습니다.
              </span>
            </div>

            <div className="panel-actions">
              <button type="button" className="btn ghost" onClick={close}>
                취소
              </button>
              <button type="button" className="btn primary" onClick={submit} disabled={submitting || !code.trim()}>
                {submitting ? '연결 중…' : '연결'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
