import type { AiEvent, AskOptions, BridgeHealth } from './types';

/**
 * 로컬 브리지 경로 — 내 PC 의 Claude Code 를 부른다.
 *
 * 요청은 브라우저에서 `http://127.0.0.1:<port>` 로 직접 나간다. 이 앱의 서버(정적 파일 서버)는
 * 경유하지 않는다. 루프백은 "potentially trustworthy origin" 이라 https 페이지에서도 부를 수 있다.
 *
 * **브리지의 CORS 허용 오리진에 이 앱의 주소가 들어 있어야 한다.** dev 는 `localhost:3200` 이
 * 기본 목록에 있고, 다른 포트나 배포 주소에서 쓸 때는 브리지를 `--allow-origin <URL>` 로 띄운다.
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

/** 브리지가 지금 쓸 수 있는 상태인가. `loggedIn` 이 null 이면 확인 못한 것이라 막지 않는다 */
export function bridgeUsable(health: BridgeHealth | null): boolean {
  return Boolean(health?.claudeCli?.found && health.claudeCli.loggedIn !== false);
}

export async function* askBridge(
  opts: AskOptions & { baseUrl: string; token: string; model: string },
): AsyncGenerator<AiEvent> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/chat`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
      body: JSON.stringify({
        message: opts.prompt,
        // 브리지는 첫 턴에만 지침을 붙인다 (이후 턴은 --resume 으로 맥락이 이어진다)
        systemPrompt: opts.system,
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
      hint: `터미널에서 \`npm run bridge\` 가 켜져 있는지 확인하세요 (${opts.baseUrl}).`,
    };
    return;
  }

  if (!res.ok || !res.body) {
    let detail: { message?: string; hint?: string | null } = {};
    try {
      detail = await res.json();
    } catch {
      /* 본문이 JSON 이 아닐 수 있다 */
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

      // 제너레이터 안에서 yield 해야 하므로 SSE 파서를 여기서 직접 돌린다
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

        if (event === 'meta' || event === 'done') {
          const id = payload.sessionId;
          if (typeof id === 'string' || id === null) yield { type: 'session', id };
        } else if (event === 'delta') {
          yield { type: 'delta', text: String(payload.text ?? '') };
        } else if (event === 'error') {
          yield {
            type: 'error',
            message: String(payload.message ?? '알 수 없는 오류'),
            hint: (payload.hint as string | null) ?? null,
          };
        }
        // thinking·notice 는 이 앱에서 쓰지 않는다 — 저작 결과와 심문 답변만 필요하다
      }
    }
  } catch (e) {
    if (!opts.signal.aborted) {
      yield { type: 'error', message: `스트림이 끊겼습니다: ${(e as Error).message}`, hint: null };
    }
  } finally {
    // 중단하면 연결을 끊는다. 브리지가 종료를 감지해 claude 프로세스를 정리한다.
    try {
      await reader.cancel();
    } catch {
      /* 이미 닫힌 스트림 */
    }
  }
}
