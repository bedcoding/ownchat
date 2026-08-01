import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 페어링 토큰 — 이 브리지를 부를 수 있는 유일한 자격증명.
 *
 * 로컬 HTTP 서버는 사용자가 방문하는 아무 웹페이지나 요청을 보낼 수 있는 대상이다.
 * 브리지는 사용자의 Claude 구독으로 요청을 날리는 물건이므로, 토큰 없이는
 * 어떤 요청도 처리하지 않는다(/health 제외).
 */

const TOKEN_BYTES = 24;

function tokenFile(home) {
  return path.join(home, 'bridge-token');
}

function newToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

/** 사람이 옮겨 적기 쉽게 4자씩 끊어 보여준다. 실제 값은 원문 그대로 쓴다 */
export function formatForDisplay(token) {
  return token.match(/.{1,8}/g)?.join(' ') ?? token;
}

export function loadOrCreateToken(home, { reset = false } = {}) {
  fs.mkdirSync(home, { recursive: true });
  const file = tokenFile(home);

  if (!reset) {
    try {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing) return existing;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  const token = newToken();
  // mode는 생성 시점에만 적용된다. 이미 있던 파일을 덮어쓸 때를 대비해 chmod도 건다.
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows는 POSIX 퍼미션이 없다. 사용자 프로필 디렉터리의 ACL을 그대로 상속한다.
  }
  return token;
}

/**
 * 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 해시로 길이를 맞춘다.
 * 문자열 === 비교는 첫 불일치에서 빠져나와 타이밍 정보를 흘린다.
 */
export function tokenMatches(expected, provided) {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(provided).digest();
  return crypto.timingSafeEqual(a, b);
}

/** `Authorization: Bearer <token>` 에서 토큰만 뽑는다 */
export function bearerFrom(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1].trim() : null;
}
