'use client';

import { subscriptionPossible } from '@/lib/capabilities';
import type { Resolution } from '@/lib/providers';
import type { BridgeHealth, Settings } from '@/lib/types';
import LoginButton from './LoginButton';

interface Props {
  resolution: Resolution;
  health: BridgeHealth | null;
  settings: Settings;
  onOpenSettings: () => void;
  onLoginStarted: () => void;
}

export default function EmptyState({ resolution, health, settings, onOpenSettings, onLoginStarted }: Props) {
  if (resolution.provider) {
    return (
      <div className="empty">
        <h1>무엇이든 물어보세요</h1>
        <p>{resolution.reason}</p>
        {resolution.provider !== 'apikey' && health ? (
          <p className="brand-sub">
            Claude Code {health.claudeCli.version} · 웹 도구 {health.webTools ? '켜짐' : '꺼짐'}
          </p>
        ) : null}
      </div>
    );
  }

  // Claude Code는 준비됐고 로그인만 남은 상태 — 버튼 하나로 끝낼 수 있다.
  if (resolution.blocking === 'need_login') {
    return (
      <div className="empty">
        <h1>Claude 로그인만 하면 됩니다</h1>
        <p>
          아래 버튼을 누르면 브라우저에서 Claude 로그인 창이 열립니다. 로그인이 끝나면 이 화면이 자동으로
          넘어갑니다.
        </p>
        <p style={{ marginTop: 16 }}>
          <LoginButton settings={settings} onStarted={onLoginStarted} label="Claude 로그인 창 열기" />
        </p>
        <p className="brand-sub" style={{ marginTop: 20 }}>
          로그인 처리는 이 PC에 설치된 공식 Claude Code가 합니다. 발급된 토큰은 Claude Code가 자기 저장소에 넣고,
          ownchat은 저장하지도 읽지도 않습니다.
        </p>
      </div>
    );
  }

  // 폰·태블릿: 구독 경로가 존재할 수 없다. 실행할 수 없는 안내를 늘어놓지 않고
  // 가능한 하나로 곧장 안내한다.
  if (!subscriptionPossible()) {
    return (
      <div className="empty">
        <h1>API 키를 넣으면 바로 쓸 수 있습니다</h1>
        <p>
          이 기기에서는 구독 요금으로 쓸 수 없습니다 — 그건 내 기기에서 공식 Claude Code를 돌려야 하고, 그건 폰에서
          동작하지 않습니다.
        </p>

        <ol className="steps">
          <li>
            <strong>지금 쓰려면</strong> — console.anthropic.com에서 API 키를 만들어 설정에 넣으세요. 설치할 것은
            없고, 사용한 토큰만큼 본인에게 청구됩니다.
          </li>
          <li>
            <strong>구독 요금으로 쓰려면</strong> — PC에서 데스크톱 앱을 쓰세요. 이미 Claude Pro/Max를 구독 중이라면
            따로 청구되는 금액이 없습니다.
          </li>
        </ol>

        <p style={{ marginTop: 16 }}>
          <button type="button" className="btn primary" onClick={onOpenSettings}>
            API 키 입력
          </button>
        </p>

        <p className="brand-sub" style={{ marginTop: 20 }}>
          키는 이 브라우저에만 저장되고, 요청은 이 기기에서 Anthropic으로 직접 나갑니다. 이 사이트의 서버는 대화
          내용도 키도 받지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="empty">
      <h1>연결이 필요합니다</h1>
      <p>{resolution.reason}</p>

      <ol className="steps">
        <li>
          <strong>구독으로 쓰기</strong> — 이미 Claude Pro/Max를 쓰고 있다면 따로 청구되는 금액이 없습니다.
          {resolution.blocking === 'need_cli' ? (
            <>
              <br />
              <code>npm i -g @anthropic-ai/claude-code</code> 로 Claude Code를 설치한 뒤 [다시 확인]을 누르세요.
            </>
          ) : (
            <>
              <br />
              터미널에서 <code>npx @ownchat/bridge</code> 를 실행하고, 찍히는 페어링 코드를 설정에 붙여넣으세요.
              데스크톱 앱을 쓰면 이 과정이 필요 없습니다.
            </>
          )}
        </li>
        <li>
          <strong>API 키로 쓰기</strong> — 구독이 없거나, 폰·태블릿처럼 Claude Code를 못 돌리는 기기에서.
          <br />
          console.anthropic.com에서 키를 만들어 설정에 넣으면 됩니다. 사용한 토큰만큼 본인에게 청구됩니다.
        </li>
      </ol>

      <p style={{ marginTop: 16 }}>
        <button type="button" className="btn primary" onClick={onOpenSettings}>
          설정 열기
        </button>
      </p>

      <p className="brand-sub" style={{ marginTop: 20 }}>
        어느 쪽이든 페어링 코드와 API 키는 이 브라우저에만 저장되고, 요청은 브라우저에서 직접 나갑니다. 이 사이트의
        서버는 대화 내용도 자격증명도 받지 않습니다.
      </p>
    </div>
  );
}
