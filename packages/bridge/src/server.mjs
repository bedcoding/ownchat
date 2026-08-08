import http from 'node:http';
import { LoginFlow, authStatus } from '@ownchat/core/auth';
import { explainFailure, isAllowedModel, isValidSessionId, resolveCli, runTurn } from '@ownchat/core/claude-cli';
import { renderLoginPage } from './login-page.mjs';
import { buildPrompt } from '@ownchat/core/prompt';
import { bearerFrom, tokenMatches } from './token.mjs';

export const PROTOCOL_VERSION = 1;

const MAX_BODY_BYTES = 128 * 1024;
const MAX_CONCURRENT_RUNS = 3;
const MAX_MESSAGE_CHARS = 60_000;

// ── 요청 검증 ─────────────────────────────────────────────────────────────────

/**
 * DNS 리바인딩 방어. 공격자가 자기 도메인의 A 레코드를 127.0.0.1로 바꿔 두면
 * 브라우저는 그 도메인을 "동일 오리진"으로 취급해 CORS를 우회할 수 있다.
 * 그때 Host 헤더에는 공격자 도메인이 담기므로, 로컬 호스트명만 통과시킨다.
 */
function hostAllowed(hostHeader, port) {
  if (typeof hostHeader !== 'string') return false;
  const allowed = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  return allowed.includes(hostHeader.toLowerCase());
}

function corsHeaders(origin, origins) {
  // Origin이 없는 요청(curl 등)은 CORS 헤더가 필요 없다. 토큰 검사는 그대로 적용된다.
  if (!origin) return {};
  if (!origins.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // Chrome의 Private Network Access: 공개 사이트가 로컬 주소를 부를 때 프리플라이트에서 요구한다
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('요청 본문이 너무 큽니다'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── 응답 헬퍼 ─────────────────────────────────────────────────────────────────

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function openSse(res, extraHeaders = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // 앞단에 프록시가 끼어도 버퍼링하지 않게 한다
    'X-Accel-Buffering': 'no',
    ...extraHeaders,
  });
  res.flushHeaders?.();
}

function sse(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── 서버 ─────────────────────────────────────────────────────────────────────

function sendHtml(res, status, html) {
  const payload = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    // 브리지가 서빙하는 페이지는 자기 자신 외 어디에도 붙지 않는다.
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(payload);
}

export function createServer({ config, token, version }) {
  let running = 0;
  /** 같은 세션에 두 턴이 동시에 들어가면 CLI 세션 파일이 꼬인다 */
  const busySessions = new Set();
  const login = new LoginFlow();

  async function handleChat(req, res, cors) {
    const raw = await readBody(req);
    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      sendJson(res, 400, { error: 'bad_json', message: '본문이 JSON이 아닙니다.' }, cors);
      return;
    }

    const text = typeof body.message === 'string' ? body.message.trim() : '';
    if (!text) {
      sendJson(res, 400, { error: 'empty_message', message: 'message가 비어 있습니다.' }, cors);
      return;
    }
    if (text.length > MAX_MESSAGE_CHARS) {
      sendJson(res, 413, { error: 'message_too_long', message: `메시지는 ${MAX_MESSAGE_CHARS}자까지입니다.` }, cors);
      return;
    }

    const sessionId = body.sessionId && isValidSessionId(body.sessionId) ? body.sessionId : null;
    if (body.sessionId && !sessionId) {
      sendJson(res, 400, { error: 'bad_session', message: 'sessionId 형식이 잘못됐습니다.' }, cors);
      return;
    }

    const model = isAllowedModel(body.model) ? body.model : config.defaultModel;

    if (running >= MAX_CONCURRENT_RUNS) {
      sendJson(res, 429, { error: 'busy', message: '동시에 처리할 수 있는 대화 수를 넘었습니다.' }, cors);
      return;
    }
    if (sessionId && busySessions.has(sessionId)) {
      sendJson(res, 409, { error: 'session_busy', message: '이 대화는 아직 이전 응답을 처리 중입니다.' }, cors);
      return;
    }

    // 슬롯과 세션은 첫 await 전에 예약한다. 그렇지 않으면 동시에 들어온 요청 둘이
    // 같은 running/busySessions 값을 보고 모두 통과할 수 있다.
    running += 1;
    if (sessionId) busySessions.add(sessionId);

    let heartbeat = null;
    let abort = null;
    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
      abort?.();
    });

    try {
      const cli = await resolveCli(config.cliCmd);
      if (!cli) {
        sendJson(
          res,
          503,
          {
            error: 'cli_not_found',
            message: 'Claude Code를 찾지 못했습니다.',
            hint: '`npm install -g @anthropic-ai/claude-code` 로 설치한 뒤 `claude` 를 한 번 실행해 로그인하세요. 설치했는데도 안 잡히면 브리지를 `--cli <전체경로>` 로 실행하세요.',
          },
          cors,
        );
        return;
      }

      openSse(res, cors);
      heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(': keep-alive\n\n');
      }, 15_000);

      const result = await runTurn(
        {
          cmd: cli.cmd,
          cwd: config.workspace,
          prompt: buildPrompt({ text, isFirstTurn: !sessionId, systemPrompt: body.systemPrompt }),
          model,
          sessionId,
          allowWebTools: config.allowWebTools,
          keepEnvAuth: config.keepEnvAuth,
        },
        (evt) => {
          if (clientGone) return;
          switch (evt.kind) {
            case 'spawn':
              abort = evt.abort;
              break;
            case 'meta':
              sse(res, 'meta', { sessionId: evt.sessionId, model: evt.model });
              break;
            case 'text':
              sse(res, 'delta', { text: evt.text });
              break;
            case 'thinking':
              sse(res, 'thinking', { text: evt.text });
              break;
            case 'notice':
              sse(res, 'notice', { message: evt.message });
              break;
            default:
              break;
          }
        },
      );
      if (!clientGone) {
        sse(res, 'done', {
          sessionId: result.sessionId,
          costUsd: result.costUsd,
          durationMs: result.durationMs,
        });
      }
    } catch (e) {
      if (!clientGone) {
        if (res.headersSent) sse(res, 'error', explainFailure(e.raw || e.message));
        else sendJson(res, e.status || 500, { error: 'internal', ...explainFailure(e.raw || e.message) }, cors);
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      running -= 1;
      if (sessionId) busySessions.delete(sessionId);
      if (!res.writableEnded) res.end();
    }
  }

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin || null;
    const cors = corsHeaders(origin, config.origins);

    if (!hostAllowed(req.headers.host, config.port)) {
      sendJson(res, 421, { error: 'bad_host', message: '이 브리지는 로컬에서만 호출할 수 있습니다.' });
      return;
    }

    if (cors === null) {
      // 허용목록에 없는 웹페이지. CORS 헤더를 붙이지 않으면 브라우저가 응답을 못 읽지만,
      // 요청 자체는 이미 도착한 뒤다. 여기서 명시적으로 끊는다.
      sendJson(res, 403, { error: 'origin_not_allowed', message: `허용되지 않은 오리진입니다: ${origin}` });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${config.port}`);

    // /health 만 토큰 없이 열어 둔다. UI가 "브리지가 켜져 있나"를 확인하는 용도라
    // 어떤 대화도 시작하지 않고, 민감한 값을 담지 않는다.
    if (req.method === 'GET' && url.pathname === '/health') {
      (async () => {
        const cli = await resolveCli(config.cliCmd);
        // `claude auth status --json` 은 토큰을 쓰지 않는다. 그래서 대화를 한 번 날려보지 않고도
        // 로그인 여부를 정확히 알 수 있다.
        const auth = cli ? await authStatus(cli.cmd) : null;
        sendJson(
          res,
          200,
          {
            ok: true,
            name: 'ownchat-bridge',
            version,
            protocol: PROTOCOL_VERSION,
            defaultModel: config.defaultModel,
            webTools: config.allowWebTools,
            claudeCli: cli
              ? {
                  found: true,
                  version: cli.version,
                  loggedIn: auth?.loggedIn ?? null,
                  authMethod: auth?.authMethod ?? null,
                }
              : { found: false, version: null, loggedIn: null, authMethod: null },
            login: login.snapshot(),
          },
          cors,
        );
      })();
      return;
    }

    // ── 로그인 화면 ──────────────────────────────────────────────────────────
    // 브라우저가 직접 여는 페이지라 Bearer 헤더를 실을 수 없다. 대신 코드 제출은
    // 페이지에 심어 준 1회용 nonce로만 가능하고, 흐름을 시작하는 쪽(/v1/login)은 토큰이 필요하다.
    if (req.method === 'GET' && url.pathname === '/login') {
      (async () => {
        const cli = await resolveCli(config.cliCmd);
        const auth = cli ? await authStatus(cli.cmd, { fresh: true }) : null;
        sendHtml(res, 200, renderLoginPage({ flow: login, loggedIn: Boolean(auth?.loggedIn) }));
      })();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/login/state') {
      if (!login.nonce || url.searchParams.get('n') !== login.nonce) {
        sendJson(res, 403, { error: 'bad_nonce' }, cors);
        return;
      }
      (async () => {
        const cli = await resolveCli(config.cliCmd);
        const auth = cli ? await authStatus(cli.cmd, { fresh: login.state !== 'awaiting_code' }) : null;
        sendJson(res, 200, { ...login.snapshot(), loggedIn: Boolean(auth?.loggedIn) }, cors);
      })();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/login/code') {
      readBody(req)
        .then((raw) => {
          let body;
          try {
            body = JSON.parse(raw || '{}');
          } catch {
            sendJson(res, 400, { ok: false, message: '본문이 JSON이 아닙니다.' }, cors);
            return;
          }
          if (!login.nonce || body.nonce !== login.nonce) {
            sendJson(res, 403, { ok: false, message: '유효하지 않은 요청입니다.' }, cors);
            return;
          }
          sendJson(res, 200, login.submitCode(body.code), cors);
        })
        .catch((e) => sendJson(res, e.status || 500, { ok: false, message: e.message }, cors));
      return;
    }

    const provided = bearerFrom(req.headers.authorization);
    if (!tokenMatches(token, provided)) {
      sendJson(
        res,
        401,
        { error: 'unauthorized', message: '페어링 코드가 없거나 틀립니다.', hint: '브리지를 실행한 터미널에 찍힌 코드를 설정에 붙여넣으세요.' },
        cors,
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/auth') {
      (async () => {
        const cli = await resolveCli(config.cliCmd);
        if (!cli) {
          sendJson(res, 503, { error: 'cli_not_found', message: 'Claude Code를 찾지 못했습니다.' }, cors);
          return;
        }
        const auth = await authStatus(cli.cmd, { fresh: url.searchParams.get('fresh') === '1' });
        sendJson(
          res,
          200,
          {
            loggedIn: auth?.loggedIn ?? null,
            authMethod: auth?.authMethod ?? null,
            apiProvider: auth?.apiProvider ?? null,
            login: login.snapshot(),
          },
          cors,
        );
      })();
      return;
    }

    // 채팅 UI의 "로그인" 버튼이 부르는 곳. 공식 CLI의 로그인 흐름을 띄우고
    // 코드를 입력할 로컬 페이지 주소를 돌려준다.
    if (req.method === 'POST' && url.pathname === '/v1/login') {
      (async () => {
        const cli = await resolveCli(config.cliCmd);
        if (!cli) {
          sendJson(
            res,
            503,
            {
              error: 'cli_not_found',
              message: 'Claude Code를 찾지 못했습니다.',
              hint: '`npm install -g @anthropic-ai/claude-code` 로 먼저 설치하세요.',
            },
            cors,
          );
          return;
        }
        const snapshot = await login.start(cli.cmd);
        sendJson(
          res,
          snapshot.state === 'error' ? 502 : 200,
          { ...snapshot, pageUrl: `http://127.0.0.1:${config.port}/login` },
          cors,
        );
      })();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/status') {
      resolveCli(config.cliCmd).then((cli) => {
        sendJson(
          res,
          200,
          {
            ok: true,
            protocol: PROTOCOL_VERSION,
            workspace: config.workspace,
            allowedOrigins: [...config.origins],
            defaultModel: config.defaultModel,
            webTools: config.allowWebTools,
            running,
            claudeCli: cli ? { found: true, cmd: cli.cmd, version: cli.version } : { found: false },
          },
          cors,
        );
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat') {
      handleChat(req, res, cors).catch((e) => {
        if (res.headersSent) {
          sse(res, 'error', { code: 'internal', message: e.message });
          res.end();
        } else {
          sendJson(res, e.status || 500, { error: 'internal', message: e.message }, cors);
        }
      });
      return;
    }

    sendJson(res, 404, { error: 'not_found', message: `${req.method} ${url.pathname} 경로가 없습니다.` }, cors);
  });

  return server;
}
