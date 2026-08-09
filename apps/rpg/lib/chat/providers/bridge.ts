import type { BridgeHealth, SendOptions, StreamEvent } from '../types';

/**
 * 로컬 브리지 공급자.
 *
 * 요청은 브라우저 → http://127.0.0.1:<port> 로 직접 나간다. 이 앱의 서버는 경유하지 않는다.
 * 브라우저가 https 페이지에서 http://127.0.0.1 을 부를 수 있는 이유는 루프백 주소가
 * "potentially trustworthy origin"으로 취급되어 혼합 콘텐츠 차단 대상이 아니기 때문이다.
 * 대신 Chrome은 Private Network Access 프리플라이트를 요구하므로, 브리지가
 * Access-Control-Allow-Private-Network 헤더로 응답한다.
 */

const HEALTH_TIMEOUT_MS = 2000;

export async function checkBridge(baseUrl: string): Promise<BridgeHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as BridgeHealth;
    return body?.name === 'ownchat-bridge' ? body : null;
  } catch {
    // 브리지가 꺼져 있으면 연결 거부로 여기 온다. 정상적인 경로다.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface LoginStart {
  ok: boolean;
  /** 코드를 입력할 로컬 페이지. 브리지가 직접 서빙한다 */
  pageUrl?: string;
  message?: string;
  hint?: string | null;
}

/**
 * 공식 CLI의 로그인 흐름을 시작시킨다.
 *
 * 코드 입력은 브리지가 서빙하는 로컬 페이지에서 받는다 — 계정 접근으로 교환되는 값이
 * 이 사이트의 자바스크립트를 지나가지 않게 하기 위함이다.
 */
export async function startLogin(baseUrl: string, token: string): Promise<LoginStart> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/login`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      pageUrl?: string;
      message?: string;
      hint?: string | null;
      error?: string | null;
      state?: string;
    };
    if (!res.ok) {
      return { ok: false, message: body.message ?? `브리지가 ${res.status} 를 반환했습니다.`, hint: body.hint ?? null };
    }
    if (body.state === 'error') {
      return { ok: false, message: body.error ?? '로그인 흐름을 시작하지 못했습니다.' };
    }
    return { ok: true, pageUrl: body.pageUrl };
  } catch {
    return { ok: false, message: '브리지에 연결하지 못했습니다.' };
  }
}

export async function* streamBridge(
  opts: SendOptions & { baseUrl: string; token: string },
): AsyncGenerator<StreamEvent> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/chat`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.token}`,
      },
      body: JSON.stringify({
        message: opts.message,
        model: opts.model,
        sessionId: opts.sessionId ?? null,
      }),
      signal: opts.signal,
    });
  } catch {
    if (opts.signal.aborted) return;
    yield {
      type: 'error',
      message: '브리지에 연결하지 못했습니다.',
      hint: `터미널에서 브리지가 켜져 있는지 확인하세요 (${opts.baseUrl}).`,
    };
    return;
  }

  if (!res.ok || !res.body) {
    let detail: { message?: string; hint?: string | null } = {};
    try {
      detail = await res.json();
    } catch {
      /* 본문이 JSON이 아닐 수 있다 */
    }
    yield {
      type: 'error',
      message: detail.message ?? `브리지가 ${res.status} 를 반환했습니다.`,
      hint: detail.hint ?? null,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 제너레이터 안에서 yield 해야 하므로 파서를 직접 돌린다
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of chunk.split('\n')) {
          if (line.startsWith(':')) continue;
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length === 0) continue;

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataLines.join('\n'));
        } catch {
          continue;
        }

        switch (event) {
          case 'meta':
            yield { type: 'meta', sessionId: payload.sessionId as string | null, model: payload.model as string | null };
            break;
          case 'delta':
            yield { type: 'delta', text: String(payload.text ?? '') };
            break;
          case 'thinking':
            yield { type: 'thinking', text: String(payload.text ?? '') };
            break;
          case 'notice':
            yield { type: 'notice', message: String(payload.message ?? '') };
            break;
          case 'done':
            yield {
              type: 'done',
              sessionId: (payload.sessionId as string | null) ?? null,
              costUsd: (payload.costUsd as number | null) ?? null,
            };
            break;
          case 'error':
            yield {
              type: 'error',
              message: String(payload.message ?? '알 수 없는 오류'),
              hint: (payload.hint as string | null) ?? null,
            };
            break;
          default:
            break;
        }
      }
    }
  } catch (e) {
    if (!opts.signal.aborted) {
      yield { type: 'error', message: `스트림이 끊겼습니다: ${(e as Error).message}`, hint: null };
    }
  } finally {
    // 사용자가 중단하면 연결을 끊는다. 브리지는 연결 종료를 감지해 claude 프로세스를 정리한다.
    try {
      await reader.cancel();
    } catch {
      /* 이미 닫힌 스트림 */
    }
  }
}
