import { BrowserWindow, app, ipcMain, protocol, shell } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LoginFlow,
  authStatus,
  buildPrompt,
  explainFailure,
  isAllowedModel,
  isValidSessionId,
  resolveCli,
  runTurn,
} from '@ownchat/core';

/**
 * ownchat 데스크톱 앱의 메인 프로세스.
 *
 * 웹 버전과 결정적으로 다른 점: 여기서는 로컬 HTTP 서버가 필요 없다.
 * 렌더러와 메인이 같은 앱 안에 있으니 IPC로 직접 이야기한다. 그래서 웹 버전에 필요했던
 * 포트·CORS·Host 검사·페어링 코드가 전부 사라진다 — 인증할 외부 호출자가 없기 때문이다.
 *
 * 여전히 유지되는 것: 공식 Claude Code CLI를 구동한다는 사실, 그리고 이 코드가
 * 로그인 자격증명을 저장하지도 읽지도 전송하지도 않는다는 사실.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * next build(output: 'export') 결과물의 위치.
 *
 * 개발 중에는 워크스페이스의 apps/web/out 을 그대로 읽고, 패키징된 앱에서는
 * electron-builder가 app.asar 안 renderer/ 로 복사해 둔 것을 읽는다.
 */
const RENDERER_DIR = [path.join(HERE, '..', 'renderer'), path.resolve(HERE, '..', '..', 'web', 'out')].find((dir) =>
  fs.existsSync(path.join(dir, 'index.html')),
) ?? path.resolve(HERE, '..', '..', 'web', 'out');

/** next dev 서버를 쓰는 개발 모드 */
const DEV_URL = process.env.OWNCHAT_DEV_URL || null;

const DEFAULT_MODEL = process.env.OWNCHAT_MODEL || 'claude-opus-5';
const ALLOW_WEB_TOOLS = process.env.OWNCHAT_NO_WEB !== '1';
const MAX_MESSAGE_CHARS = 60_000;
const MAX_CONCURRENT_RUNS = 3;

const login = new LoginFlow();
/** 진행 중인 대화 턴: requestId → abort 함수 */
const inFlight = new Map();
const busySessions = new Set();
/** CLI 탐색 중인 요청도 동시성 한도에 포함한다. */
const reservedRuns = new Set();

let workspaceDir = null;

/** 세션 재개(--resume)는 실행 디렉터리 기준으로 조회되므로 항상 같은 빈 폴더에서 돌린다 */
function ensureWorkspace() {
  if (workspaceDir) return workspaceDir;
  workspaceDir = path.join(app.getPath('userData'), 'workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });
  return workspaceDir;
}

// ── 렌더러 서빙 ───────────────────────────────────────────────────────────────

/**
 * file:// 로 띄우면 안 된다. Next의 정적 export는 `/_next/...` 같은 절대 경로를 쓰는데
 * file:// 에서는 파일시스템 루트로 해석되고, 무엇보다 **origin이 불안정해서 localStorage가
 * 유지되지 않는다.** 이 앱은 설정·대화를 전부 localStorage에 두므로 치명적이다.
 * 그래서 고정 origin을 갖는 커스텀 스킴을 등록한다.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // BYOK 모드에서 브라우저가 Anthropic API를 직접 부른다. 그 외 외부 연결은 막는다.
  "connect-src 'self' https://api.anthropic.com",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function registerRendererProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    // 경로 조작으로 export 폴더 밖 파일을 읽지 못하게 정규화 후 검사한다.
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidate = path.resolve(RENDERER_DIR, rel || 'index.html');
    if (candidate !== RENDERER_DIR && !candidate.startsWith(RENDERER_DIR + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }

    let target = candidate;
    try {
      if ((await fsp.stat(target)).isDirectory()) target = path.join(target, 'index.html');
    } catch {
      // 단일 페이지 앱이라 없는 경로는 index.html로 넘긴다
      target = path.join(RENDERER_DIR, 'index.html');
    }

    try {
      const body = await fsp.readFile(target);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
          'Content-Security-Policy': CSP,
        },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

// ── 창 ───────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 420,
    minHeight: 480,
    backgroundColor: '#17171a',
    title: 'ownchat',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(HERE, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // 앱 안에서 외부 링크가 열리면 안 된다. OS 기본 브라우저로 넘긴다.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test(new URL(url).protocol)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // 렌더러가 외부 사이트로 이동하는 것을 막는다(피싱·자격증명 탈취 경로 차단).
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_URL ? [DEV_URL] : ['app://'];
    if (!allowed.some((prefix) => url.startsWith(prefix))) {
      event.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });

  // 렌더러는 별도 프로세스라 기본적으로 콘솔이 보이지 않는다. 문제 추적용으로 끌어온다.
  if (process.env.OWNCHAT_DEBUG) {
    win.webContents.on('console-message', (_event, _level, message, line, source) => {
      console.log(`[renderer] ${message}  (${source}:${line})`);
    });
    win.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`[renderer] 로드 실패 ${code} ${description} — ${url}`);
    });
    win.webContents.on('did-finish-load', () => console.log('[renderer] 로드 완료'));
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error('[renderer] 프로세스 종료', details);
    });
  }

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadURL('app://ownchat/index.html');

  return win;
}

// ── IPC ──────────────────────────────────────────────────────────────────────

async function currentStatus({ fresh = false } = {}) {
  const cli = await resolveCli(process.env.CLAUDE_CLI_CMD || null);
  const auth = cli ? await authStatus(cli.cmd, { fresh }) : null;
  return {
    ok: true,
    name: 'ownchat-desktop',
    version: app.getVersion(),
    protocol: 1,
    defaultModel: DEFAULT_MODEL,
    webTools: ALLOW_WEB_TOOLS,
    claudeCli: cli
      ? {
          found: true,
          version: cli.version,
          cmd: cli.cmd,
          loggedIn: auth?.loggedIn ?? null,
          authMethod: auth?.authMethod ?? null,
        }
      : { found: false, version: null, cmd: null, loggedIn: null, authMethod: null },
    login: login.snapshot(),
  };
}

function registerIpc() {
  ipcMain.handle('ownchat:status', (_e, opts) => currentStatus(opts ?? {}));

  ipcMain.handle('ownchat:login', async () => {
    const cli = await resolveCli(process.env.CLAUDE_CLI_CMD || null);
    if (!cli) {
      return {
        ok: false,
        message: 'Claude Code를 찾지 못했습니다.',
        hint: '`npm install -g @anthropic-ai/claude-code` 로 설치한 뒤 다시 시도하세요.',
      };
    }
    const snapshot = await login.start(cli.cmd);
    // CLI가 브라우저를 직접 열지만, 실패했을 때 사용자가 누를 주소도 함께 넘긴다.
    return {
      ok: snapshot.state !== 'error',
      ...snapshot,
      fallbackCommand: `${/\s/.test(cli.cmd) ? `"${cli.cmd}"` : cli.cmd} auth login`,
    };
  });

  ipcMain.handle('ownchat:loginState', async () => {
    const cli = await resolveCli(process.env.CLAUDE_CLI_CMD || null);
    const auth = cli ? await authStatus(cli.cmd, { fresh: login.state !== 'awaiting_code' }) : null;
    return { ...login.snapshot(), loggedIn: Boolean(auth?.loggedIn) };
  });

  ipcMain.handle('ownchat:loginCode', (_e, code) => login.submitCode(code));

  ipcMain.handle('ownchat:loginCancel', () => {
    login.cancel();
    return { ok: true };
  });

  ipcMain.handle('ownchat:openExternal', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.on('ownchat:chat:abort', (_e, id) => {
    inFlight.get(id)?.();
  });

  ipcMain.handle('ownchat:chat', async (event, payload) => {
    const { id, message, model: requestedModel, sessionId: rawSessionId } = payload ?? {};
    const send = (evt) => {
      if (!event.sender.isDestroyed()) event.sender.send('ownchat:chat:event', { id, event: evt });
    };

    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return { ok: false };
    if (text.length > MAX_MESSAGE_CHARS) {
      send({ type: 'error', message: `메시지는 ${MAX_MESSAGE_CHARS}자까지입니다.` });
      return { ok: false };
    }

    const sessionId = isValidSessionId(rawSessionId) ? rawSessionId : null;
    const model = isAllowedModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

    if (reservedRuns.size >= MAX_CONCURRENT_RUNS) {
      send({ type: 'error', message: '동시에 처리할 수 있는 대화 수를 넘었습니다.' });
      return { ok: false };
    }
    if (sessionId && busySessions.has(sessionId)) {
      send({ type: 'error', message: '이 대화는 아직 이전 응답을 처리 중입니다.' });
      return { ok: false };
    }

    // CLI 탐색 await 전에 예약해야 동시에 들어온 요청이 한도와 세션 잠금을 함께 통과하지 않는다.
    reservedRuns.add(id);
    if (sessionId) busySessions.add(sessionId);
    let aborted = false;

    try {
      const cli = await resolveCli(process.env.CLAUDE_CLI_CMD || null);
      if (!cli) {
        send({
          type: 'error',
          message: 'Claude Code를 찾지 못했습니다.',
          hint: '`npm install -g @anthropic-ai/claude-code` 로 설치하세요.',
        });
        return { ok: false };
      }

      const result = await runTurn(
        {
          cmd: cli.cmd,
          cwd: ensureWorkspace(),
          prompt: buildPrompt({ text, isFirstTurn: !sessionId }),
          model,
          sessionId,
          allowWebTools: ALLOW_WEB_TOOLS,
        },
        (evt) => {
          switch (evt.kind) {
            case 'spawn':
              inFlight.set(id, () => {
                aborted = true;
                evt.abort();
              });
              break;
            case 'meta':
              send({ type: 'meta', sessionId: evt.sessionId, model: evt.model });
              break;
            case 'text':
              send({ type: 'delta', text: evt.text });
              break;
            case 'thinking':
              send({ type: 'thinking', text: evt.text });
              break;
            case 'notice':
              send({ type: 'notice', message: evt.message });
              break;
            default:
              break;
          }
        },
      );
      if (!aborted) {
        send({
          type: 'done',
          sessionId: result.sessionId,
          costUsd: result.costUsd,
          durationMs: result.durationMs,
        });
      }
      return { ok: true };
    } catch (e) {
      if (!aborted) send({ type: 'error', ...explainFailure(e.raw || e.message) });
      return { ok: false };
    } finally {
      inFlight.delete(id);
      reservedRuns.delete(id);
      if (sessionId) busySessions.delete(sessionId);
    }
  });
}

// ── 부팅 ─────────────────────────────────────────────────────────────────────

// 두 개가 동시에 뜨면 같은 CLI 세션 폴더를 두 프로세스가 만지게 된다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(() => {
    if (!DEV_URL) registerRendererProtocol();
    registerIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    // 남아 있는 claude 프로세스를 정리한다. 안 하면 고아 프로세스가 계속 돈다.
    for (const abort of inFlight.values()) abort();
    login.cancel();
  });
}
