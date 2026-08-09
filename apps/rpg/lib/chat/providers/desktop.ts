import type { BridgeHealth, LoginSnapshot, SendOptions, StreamEvent } from '../types';

/**
 * 데스크톱(Electron) 공급자.
 *
 * 같은 UI 코드가 두 곳에서 돈다:
 *   - 호스팅 웹  → 로컬 브리지에 HTTP로 붙거나, 본인 API 키로 직접 호출
 *   - 데스크톱 앱 → 메인 프로세스와 IPC로 이야기 (포트·CORS·페어링 코드 없음)
 *
 * 판별은 preload가 심어 준 window.ownchat 하나로 한다.
 */

interface ChatHandle {
  done: Promise<{ ok: boolean }>;
  abort: () => void;
}

interface DesktopApi {
  isDesktop: true;
  status(opts?: { fresh?: boolean }): Promise<BridgeHealth>;
  login(): Promise<LoginSnapshot & { ok: boolean; message?: string; hint?: string | null; fallbackCommand?: string }>;
  loginState(): Promise<LoginSnapshot & { loggedIn: boolean }>;
  submitLoginCode(code: string): Promise<{ ok: boolean; message?: string }>;
  cancelLogin(): Promise<{ ok: boolean }>;
  openExternal(url: string): Promise<{ ok: boolean }>;
  chat(
    payload: { message: string; model: string; sessionId: string | null },
    onEvent: (event: StreamEvent) => void,
  ): ChatHandle;
}

declare global {
  interface Window {
    ownchat?: DesktopApi;
  }
}

export function desktopApi(): DesktopApi | null {
  if (typeof window === 'undefined') return null;
  return window.ownchat ?? null;
}

export const isDesktop = (): boolean => desktopApi() !== null;

export async function checkDesktop(): Promise<BridgeHealth | null> {
  const api = desktopApi();
  if (!api) return null;
  try {
    return await api.status();
  } catch {
    return null;
  }
}

/**
 * IPC 콜백을 async iterator로 바꾼다.
 *
 * 콜백이 이터레이터보다 빨리 도착할 수 있으므로 큐에 쌓아 두고, 소비자가 따라오게 한다.
 * 이걸 안 하면 스트리밍 앞부분이 조용히 유실된다.
 */
export async function* streamDesktop(opts: SendOptions): AsyncGenerator<StreamEvent> {
  const api = desktopApi();
  if (!api) {
    yield { type: 'error', message: '데스크톱 앱이 아닙니다.', hint: null };
    return;
  }

  const queue: StreamEvent[] = [];
  let notify: (() => void) | null = null;
  let finished = false;

  const push = (event: StreamEvent) => {
    queue.push(event);
    notify?.();
    notify = null;
  };

  const handle = api.chat(
    { message: opts.message, model: opts.model, sessionId: opts.sessionId ?? null },
    push,
  );

  const onAbort = () => handle.abort();
  opts.signal.addEventListener('abort', onAbort, { once: true });

  void handle.done.then(
    () => {
      finished = true;
      notify?.();
      notify = null;
    },
    (e: unknown) => {
      push({ type: 'error', message: (e as Error)?.message ?? 'IPC 호출이 실패했습니다.', hint: null });
      finished = true;
      notify?.();
      notify = null;
    },
  );

  try {
    for (;;) {
      while (queue.length > 0) {
        const event = queue.shift() as StreamEvent;
        yield event;
      }
      if (finished) return;
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }
  } finally {
    opts.signal.removeEventListener('abort', onAbort);
    if (!finished) handle.abort();
  }
}
