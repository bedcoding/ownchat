import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_PORT = 4319;

/**
 * 브리지를 호출해도 되는 오리진. CORS 응답 헤더를 이 목록에만 붙인다.
 *
 * CORS는 "요청을 막는" 장치가 아니라 "응답을 읽지 못하게" 하는 장치다.
 * 악성 페이지가 요청 자체는 보낼 수 있으므로 실제 방어선은 토큰(Authorization)이고,
 * 오리진 허용목록은 그 위에 얹는 두 번째 층이다.
 */
const BUILTIN_ORIGINS = [
  // ownchat 채팅 UI (apps/web)
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // 선택지 게임의 관리자 저작 화면 (apps/rpg) — 트리 초안 생성이 이 브리지를 부른다
  'http://localhost:3200',
  'http://127.0.0.1:3200',
];

function usage() {
  return `
ownchat-bridge — 내 PC의 Claude Code를 채팅 UI에 연결하는 로컬 브리지

사용법:
  npx @ownchat/bridge [옵션]

옵션:
  --port <번호>          수신 포트 (기본 ${DEFAULT_PORT})
  --allow-origin <URL>   호출을 허용할 웹 UI 오리진. 여러 번 지정 가능
  --model <별칭>         기본 모델 (claude-opus-5 | claude-sonnet-5 | claude-haiku-4-5 | claude-fable-5)
  --cli <경로>           claude 실행 파일 경로를 직접 지정 (PATH에 없을 때)
  --no-web               웹 검색/웹 페이지 읽기 도구를 끈다
  --keep-env-auth        ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN 환경변수를 지우지 않는다.
                         (기본은 지운다 — 남아 있으면 구독 대신 종량제로 청구되기 때문)
  --print-token          페어링 코드만 출력하고 종료
  --reset-token          페어링 코드를 새로 발급 (기존 코드는 즉시 무효)
  --help                 이 도움말

환경변수:
  OWNCHAT_PORT, OWNCHAT_ALLOW_ORIGIN(쉼표 구분), OWNCHAT_MODEL, OWNCHAT_HOME, CLAUDE_CLI_CMD
`.trimStart();
}

/** 오리진 문자열을 정규화한다. 경로·쿼리가 붙어 있으면 스킴+호스트만 남긴다 */
function normalizeOrigin(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function parseArgs(argv) {
  const out = {
    help: false,
    printToken: false,
    resetToken: false,
    port: null,
    origins: [],
    model: null,
    cli: null,
    web: null,
    keepEnvAuth: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--help':
      case '-h':
        out.help = true;
        break;
      case '--print-token':
        out.printToken = true;
        break;
      case '--reset-token':
        out.resetToken = true;
        break;
      case '--port':
        out.port = Number(next());
        break;
      case '--allow-origin':
        out.origins.push(next());
        break;
      case '--model':
        out.model = next();
        break;
      case '--cli':
        out.cli = next();
        break;
      case '--no-web':
        out.web = false;
        break;
      case '--web':
        out.web = true;
        break;
      case '--keep-env-auth':
        out.keepEnvAuth = true;
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`알 수 없는 옵션: ${arg}\n\n${usage()}`);
    }
  }
  return out;
}

export function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) return { help: true, usage: usage() };

  const home = process.env.OWNCHAT_HOME || path.join(os.homedir(), '.ownchat');
  // 세션 재개(--resume)는 실행 디렉터리 기준으로 조회되므로 항상 같은 곳에서 돌려야 한다.
  // 빈 디렉터리를 쓰는 이유는 프로젝트의 CLAUDE.md 같은 개발용 컨텍스트가 채팅에 딸려오지 않게 하기 위함.
  const workspace = path.join(home, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });

  const envOrigins = (process.env.OWNCHAT_ALLOW_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = new Set(BUILTIN_ORIGINS);
  for (const raw of [...envOrigins, ...args.origins]) {
    // (포트가 정해진 뒤 브리지 자신의 오리진도 아래에서 추가한다)
    const origin = normalizeOrigin(raw);
    if (!origin) throw new Error(`오리진 형식이 잘못됐습니다: ${raw} (예: https://chat.example.com)`);
    origins.add(origin);
  }

  // Number(undefined)는 null이 아니라 NaN이라 ??로 걸러지지 않는다. 있을 때만 변환한다.
  const envPort = process.env.OWNCHAT_PORT ? Number(process.env.OWNCHAT_PORT) : null;
  const port = args.port ?? envPort ?? DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`포트 번호가 잘못됐습니다: ${port}`);
  }

  // 브리지가 직접 서빙하는 로그인 페이지도 브리지를 호출한다. 자기 오리진을 막으면 안 된다.
  origins.add(`http://127.0.0.1:${port}`);
  origins.add(`http://localhost:${port}`);

  return {
    help: false,
    home,
    workspace,
    port,
    origins,
    allowWebTools: args.web ?? true,
    keepEnvAuth: args.keepEnvAuth,
    defaultModel: args.model || process.env.OWNCHAT_MODEL || 'claude-opus-5',
    cliCmd: args.cli || process.env.CLAUDE_CLI_CMD || null,
    printToken: args.printToken,
    resetToken: args.resetToken,
  };
}
