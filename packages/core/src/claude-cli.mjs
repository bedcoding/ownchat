import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { killTree, shellSafe } from './spawn-util.mjs';

/**
 * 사용자 PC에 설치된 공식 Claude Code CLI를 그대로 구동한다.
 *
 * 왜 CLI를 감싸는가: 사용자의 구독 인증(OAuth)은 Claude Code가 자기 자격증명 저장소에
 * 들고 있다. 브리지는 그 토큰을 읽지도, 네트워크로 보내지도 않는다 — 공식 바이너리를
 * 로컬에서 실행할 뿐이고, Anthropic으로 나가는 요청은 전부 Claude Code가 만든다.
 *
 * `--bare`를 절대 쓰지 않는 이유: bare 모드는 OAuth와 키체인 읽기를 건너뛴다.
 * 즉 구독으로는 동작하지 않고 ANTHROPIC_API_KEY를 요구한다. 이 브리지의 존재 이유와 정반대다.
 */

/** 채팅 용도이므로 파일·셸·에이전트 도구는 전부 막는다. 대화 내용에 섞여 들어온 지시로 로컬이 건드려지면 안 된다 */
const ALWAYS_DENIED = [
  'Bash',
  'BashOutput',
  'KillShell',
  'KillBash',
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'Glob',
  'Grep',
  'Task',
  'Agent',
  'SlashCommand',
  'ExitPlanMode',
  'TodoWrite',
];
const WEB_TOOLS = ['WebSearch', 'WebFetch'];

const ALLOWED_MODELS = new Set([
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-haiku-4-5',
  'claude-fable-5',
  'opus',
  'sonnet',
  'haiku',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function isAllowedModel(model) {
  return typeof model === 'string' && ALLOWED_MODELS.has(model);
}

// ── 실행 파일 찾기 ────────────────────────────────────────────────────────────

/**
 * npm 전역 bin이 PATH에 없는 머신이 흔하다(특히 Windows). PATH를 먼저 보고,
 * 없으면 표준 설치 위치를 순서대로 확인한다.
 */
function candidates(explicit) {
  if (explicit) return [explicit];
  const home = os.homedir();
  const known =
    process.platform === 'win32'
      ? [
          path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'npm', 'claude.cmd'),
          path.join(home, '.claude', 'local', 'claude.cmd'),
        ]
      : [
          path.join(home, '.claude', 'local', 'claude'),
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude',
          path.join(home, '.npm-global', 'bin', 'claude'),
        ];
  return ['claude', ...known.filter((p) => fs.existsSync(p))];
}

function probe(cmd) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(shellSafe(cmd), ['--version'], {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      resolve(null);
      return;
    }
    let out = '';
    const timer = setTimeout(() => {
      killTree(child);
      resolve(null);
    }, 10_000);
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { cmd, version: out.trim().split('\n')[0] || 'unknown' } : null);
    });
  });
}

let resolved;

/** 실제로 실행되는 claude 경로와 버전. 없으면 null. 프로세스 수명 동안 캐시한다 */
export async function resolveCli(explicit) {
  if (resolved !== undefined) return resolved;
  for (const cmd of candidates(explicit)) {
    const hit = await probe(cmd);
    if (hit) {
      resolved = hit;
      return hit;
    }
  }
  resolved = null;
  return null;
}

export function resetCliCache() {
  resolved = undefined;
}

// ── 인자 조립 ────────────────────────────────────────────────────────────────

/**
 * Windows에서 `.cmd` 셔임을 실행하려면 shell:true가 필요한데(Node 20.12+는 shell 없이
 * .cmd 실행을 막는다), shell:true는 인자를 자동으로 따옴표 처리해주지 않는다.
 * 그래서 인자로 넘기는 값은 전부 공백·따옴표가 없는 형태로만 유지한다.
 * 페르소나(시스템 프롬프트)처럼 긴 텍스트는 인자가 아니라 stdin으로 넣는다.
 */
function buildArgs({ model, sessionId, allowWebTools }, { partialMessages, modernFlags }) {
  const denied = allowWebTools ? ALWAYS_DENIED : [...ALWAYS_DENIED, ...WEB_TOOLS];
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];

  if (partialMessages) args.push('--include-partial-messages');

  // 도구 차단은 안전장치라 절대 떨어뜨리지 않는다. 쉼표 구분이라 공백이 없다.
  args.push('--disallowed-tools', denied.join(','));

  if (modernFlags) {
    // --mcp-config 없이 이 플래그만 주면 MCP 서버를 하나도 붙이지 않는다.
    args.push('--strict-mcp-config');
    args.push('--permission-mode', 'dontAsk');
  }

  if (model && isAllowedModel(model)) args.push('--model', model);
  if (sessionId && isValidSessionId(sessionId)) args.push('--resume', sessionId);
  return args;
}

const UNSUPPORTED_FLAG_RE = /unknown (option|argument)|unrecognized|invalid (option|argument|choice)|--(include-partial-messages|permission-mode|strict-mcp-config)/i;

const NOT_LOGGED_IN_RE = /not logged in|login expired|please run \/login|authentication_failed|invalid api key/i;
const RATE_LIMIT_RE = /rate limit|usage limit|quota/i;

/** CLI가 뱉은 실패 메시지를 사용자가 읽고 뭘 해야 할지 알 수 있는 문장으로 바꾼다 */
export function explainFailure(raw) {
  const detail = (raw || '').trim().slice(0, 400);
  if (NOT_LOGGED_IN_RE.test(detail)) {
    return {
      code: 'not_logged_in',
      message: 'Claude Code에 로그인되어 있지 않습니다.',
      hint: '터미널에서 `claude` 를 한 번 실행해 로그인한 뒤 다시 시도하세요.',
      detail,
    };
  }
  if (RATE_LIMIT_RE.test(detail)) {
    return {
      code: 'rate_limited',
      message: '구독 사용량 한도에 걸렸습니다.',
      hint: '한도 창이 초기화될 때까지 기다리거나, 설정에서 API 키 모드로 전환하세요.',
      detail,
    };
  }
  return { code: 'cli_error', message: 'Claude Code 실행이 실패했습니다.', hint: null, detail };
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

/**
 * 한 번의 대화 턴을 실행한다. stdout의 NDJSON을 파싱해 onEvent로 흘려보낸다.
 *
 * onEvent 로 오는 것들:
 *   { kind: 'meta',   sessionId, model }
 *   { kind: 'text',   text }        스트리밍 조각 또는(부분 스트리밍 미지원 시) 완성된 답변
 *   { kind: 'thinking', text }
 *   { kind: 'notice', message }     재시도 등 진행 상황
 *
 * 반환값: { sessionId, costUsd, durationMs }
 */
export function runTurn(
  { cmd, cwd, prompt, model, sessionId, allowWebTools, keepEnvAuth = false, timeoutMs = 600_000 },
  onEvent,
) {
  let attemptModern = true;
  let attemptPartial = true;

  const attempt = () =>
    new Promise((resolve, reject) => {
      const args = buildArgs(
        { model, sessionId, allowWebTools },
        { partialMessages: attemptPartial, modernFlags: attemptModern },
      );

      // 구독으로 쓰려는데 환경에 API 키가 남아 있으면 Claude Code는 그쪽을 우선한다
      // (인증 우선순위상 API 키가 구독 OAuth보다 위). 그러면 "구독으로 쓰는 중"이라고
      // 표시해 놓고 실제로는 종량제로 청구된다. 그래서 기본적으로 지운다.
      // 사내 LLM 게이트웨이처럼 이 값이 있어야 동작하는 환경은 --keep-env-auth 로 유지한다.
      // env 객체에 undefined를 넣으면 플랫폼에 따라 "undefined" 문자열이 되므로 delete로 지운다.
      const childEnv = { ...process.env };
      if (!keepEnvAuth) {
        delete childEnv.ANTHROPIC_API_KEY;
        delete childEnv.ANTHROPIC_AUTH_TOKEN;
      }

      const child = spawn(shellSafe(cmd), args, {
        cwd,
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv,
      });
      // 클라이언트가 연결을 끊으면 프로세스 트리를 정리할 수 있게 핸들을 먼저 넘긴다
      onEvent({ kind: 'spawn', abort: () => killTree(child) });

      const state = { sessionId: sessionId || null, model: null, costUsd: null, durationMs: null, emitted: false };
      let stdoutBuf = '';
      let stderr = '';
      let tail = ''; // 종료 사유 추적용으로 stdout 끝부분만 들고 있는다
      let emittedText = ''; // 실패했을 때 사유가 본문에 담겨 오는 경우가 있어 따로 모은다
      let finished = false;

      const timer = setTimeout(() => {
        killTree(child);
        reject(Object.assign(new Error(`Claude Code 응답 시간 초과 (${Math.round(timeoutMs / 1000)}초)`), { code: 'timeout' }));
      }, timeoutMs);

      const settleReject = (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(err);
      };

      const handleLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt;
        try {
          evt = JSON.parse(trimmed);
        } catch {
          // NDJSON이 아닌 경고문이 섞여 나올 수 있다. 실패 원인 추적용으로만 모은다.
          tail = `${tail}\n${trimmed}`.slice(-1000);
          return;
        }

        if (evt.type === 'system' && evt.subtype === 'init') {
          state.sessionId = evt.session_id ?? state.sessionId;
          state.model = evt.model ?? state.model;
          onEvent({ kind: 'meta', sessionId: state.sessionId, model: state.model });
          return;
        }

        if (evt.type === 'system' && evt.subtype === 'api_retry') {
          onEvent({
            kind: 'notice',
            message: `Anthropic 응답 재시도 중 (${evt.attempt}/${evt.max_retries}, ${evt.error})`,
          });
          return;
        }

        const emitText = (text) => {
          state.emitted = true;
          emittedText = `${emittedText}${text}`.slice(-1000);
          onEvent({ kind: 'text', text });
        };

        if (evt.type === 'stream_event') {
          const delta = evt.event?.delta;
          if (delta?.type === 'text_delta' && delta.text) {
            emitText(delta.text);
          } else if (delta?.type === 'thinking_delta' && delta.thinking) {
            onEvent({ kind: 'thinking', text: delta.thinking });
          }
          return;
        }

        // --include-partial-messages를 못 쓰는 버전에서는 완성된 assistant 메시지로만 온다.
        // 이미 뭔가 내보냈다면 같은 내용을 두 번 보내지 않는다.
        if (evt.type === 'assistant' && !state.emitted) {
          for (const block of evt.message?.content ?? []) {
            if (block.type === 'text' && block.text) emitText(block.text);
          }
          return;
        }

        if (evt.type === 'result') {
          state.sessionId = evt.session_id ?? state.sessionId;
          state.costUsd = evt.total_cost_usd ?? null;
          state.durationMs = evt.duration_ms ?? null;
          if (evt.subtype && evt.subtype !== 'success') {
            tail = `${tail}\n${evt.subtype}: ${evt.result ?? ''}`.slice(-1000);
          } else if (!state.emitted && typeof evt.result === 'string' && evt.result) {
            // 조각도 assistant 이벤트도 못 받은 경우의 마지막 보루
            emitText(evt.result);
          }
        }
      };

      child.stdout.on('data', (chunk) => {
        stdoutBuf += chunk;
        let idx;
        while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
          const line = stdoutBuf.slice(0, idx);
          stdoutBuf = stdoutBuf.slice(idx + 1);
          try {
            handleLine(line);
          } catch (e) {
            settleReject(e);
            killTree(child);
            return;
          }
        }
      });

      child.stderr.on('data', (d) => {
        stderr = `${stderr}${d}`.slice(-2000);
      });

      // CLI가 프롬프트를 다 읽기 전에 죽으면 stdin에 EPIPE가 뜬다. 핸들러가 없으면
      // 스트림 에러가 uncaughtException이 되어 상주 브리지까지 죽는다.
      child.stdin.on('error', () => {});

      child.on('error', (e) => settleReject(e));

      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (stdoutBuf.trim()) {
          try {
            handleLine(stdoutBuf);
          } catch {
            /* 마지막 조각이 깨졌으면 무시한다 */
          }
        }
        if (code === 0) {
          resolve({ sessionId: state.sessionId, costUsd: state.costUsd, durationMs: state.durationMs });
          return;
        }
        // CLI는 'Not logged in · Please run /login' 같은 실패 사유를 stderr가 아니라
        // 답변 본문으로 흘려보내기도 한다. 셋 다 봐야 원인을 잡아낼 수 있다.
        const raw = [stderr.trim(), tail.trim(), emittedText.trim()].filter(Boolean).join('\n');
        reject(Object.assign(new Error(raw || `claude 종료코드 ${code}`), { raw, exitCode: code }));
      });

      child.stdin.end(prompt);
    });

  const withDegrade = async () => {
    try {
      return await attempt();
    } catch (e) {
      const raw = e.raw || e.message || '';
      // 구버전 CLI라 최신 플래그를 모르는 경우에만 한 단계 낮춰 한 번 더 시도한다.
      // 도구 차단(--disallowed-tools)은 절대 떨어뜨리지 않는다 — 떨어뜨리면 안전장치가 사라진다.
      if ((attemptPartial || attemptModern) && UNSUPPORTED_FLAG_RE.test(raw)) {
        attemptPartial = false;
        attemptModern = false;
        return attempt();
      }
      throw e;
    }
  };

  return withDegrade();
}
