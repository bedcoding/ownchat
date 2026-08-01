import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { killTree, shellSafe } from './spawn-util.mjs';

/**
 * 로그인 상태 조회와 로그인 흐름.
 *
 * `claude auth status --json` 은 토큰을 소모하지 않는다. 그래서 "로그인 됐나?"를
 * 실제 대화를 한 번 날려보는 식으로 확인할 필요가 없다.
 *
 * `claude auth login --claudeai` 는 TTY 없이 실행해도 브라우저를 직접 열고,
 * 열리지 않을 경우를 위한 인증 URL을 표준출력으로 뱉는다. 그 뒤 브라우저가 보여주는
 * 코드를 표준입력으로 받는다. 브리지는 그 파이프를 중계할 뿐이고,
 * 발급된 자격증명은 공식 CLI가 자기 저장소에 넣는다 — 브리지는 토큰을 보지 않는다.
 */

const STATUS_TIMEOUT_MS = 20_000;
const STATUS_CACHE_MS = 5_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const AUTH_URL_RE = /(https:\/\/\S*oauth\/authorize\S*)/;

let statusCache = { at: 0, value: null };

function runJson(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(shellSafe(cmd), args, {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      resolve(null);
      return;
    }
    let out = '';
    const timer = setTimeout(() => {
      killTree(child);
      resolve(null);
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', () => {
      clearTimeout(timer);
      const start = out.indexOf('{');
      const end = out.lastIndexOf('}');
      if (start === -1 || end <= start) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(out.slice(start, end + 1)));
      } catch {
        resolve(null);
      }
    });
  });
}

/** { loggedIn, authMethod, apiProvider } — 알 수 없으면 null */
export async function authStatus(cmd, { fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && statusCache.value && now - statusCache.at < STATUS_CACHE_MS) return statusCache.value;
  const value = await runJson(cmd, ['auth', 'status', '--json'], STATUS_TIMEOUT_MS);
  statusCache = { at: now, value };
  return value;
}

export function invalidateAuthCache() {
  statusCache = { at: 0, value: null };
}

/**
 * 진행 중인 로그인 흐름. 한 번에 하나만 허용한다.
 */
export class LoginFlow {
  constructor() {
    this.reset();
  }

  reset() {
    this.child = null;
    this.state = 'idle'; // idle | starting | awaiting_code | finishing | done | error
    this.url = null;
    this.error = null;
    /** 로그인 페이지에서만 코드를 제출할 수 있게 하는 1회용 값 */
    this.nonce = null;
    this.log = '';
    this.timer = null;
  }

  get active() {
    return this.state === 'starting' || this.state === 'awaiting_code' || this.state === 'finishing';
  }

  snapshot() {
    return { state: this.state, url: this.url, error: this.error };
  }

  /** 로그인 프로세스를 띄우고 인증 URL이 나올 때까지 기다린다 */
  start(cmd) {
    if (this.active) return Promise.resolve(this.snapshot());

    this.reset();
    this.state = 'starting';
    this.nonce = crypto.randomBytes(18).toString('base64url');

    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve(this.snapshot());
      };

      let child;
      try {
        child = spawn(shellSafe(cmd), ['auth', 'login', '--claudeai'], {
          shell: process.platform === 'win32',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (e) {
        this.state = 'error';
        this.error = e.message;
        settle();
        return;
      }

      this.child = child;
      this.timer = setTimeout(() => {
        this.error = '로그인 대기 시간이 지났습니다.';
        this.state = 'error';
        killTree(child);
      }, LOGIN_TIMEOUT_MS);

      const onOutput = (chunk) => {
        this.log = `${this.log}${chunk}`.slice(-4000);
        if (!this.url) {
          const match = AUTH_URL_RE.exec(this.log);
          if (match) {
            this.url = match[1];
            this.state = 'awaiting_code';
            settle();
          }
        }
      };

      child.stdout.on('data', onOutput);
      child.stderr.on('data', onOutput);
      // 코드를 다 받기 전에 프로세스가 죽으면 stdin에 EPIPE가 난다.
      child.stdin.on('error', () => {});

      child.on('error', (e) => {
        clearTimeout(this.timer);
        this.state = 'error';
        this.error = e.message;
        settle();
      });

      child.on('close', (code) => {
        clearTimeout(this.timer);
        this.child = null;
        invalidateAuthCache();
        if (this.state === 'error') {
          settle();
          return;
        }
        if (code === 0) {
          this.state = 'done';
        } else {
          this.state = 'error';
          this.error = this.log.trim().slice(-300) || `로그인 프로세스가 코드 ${code}로 종료됐습니다.`;
        }
        settle();
      });

      // URL이 끝내 안 나오면 무한정 기다리지 않는다.
      setTimeout(() => {
        if (!settled) {
          if (this.state === 'starting') {
            this.state = 'error';
            this.error = '인증 주소를 받지 못했습니다. 터미널에서 `claude auth login` 을 직접 실행해 보세요.';
            killTree(child);
          }
          settle();
        }
      }, 30_000);
    });
  }

  /** 브라우저가 보여준 코드를 CLI의 표준입력으로 넘긴다 */
  submitCode(code) {
    if (!this.child || this.state !== 'awaiting_code') {
      return { ok: false, message: '진행 중인 로그인이 없습니다.' };
    }
    const clean = String(code).trim();
    // 개행이 섞이면 CLI가 여러 줄 입력으로 받아 흐름이 깨진다.
    if (!clean || /\s/.test(clean) || clean.length > 512) {
      return { ok: false, message: '코드 형식이 잘못됐습니다.' };
    }
    this.state = 'finishing';
    this.child.stdin.write(`${clean}\n`);
    return { ok: true };
  }

  cancel() {
    if (this.child) killTree(this.child);
    this.reset();
  }
}
