/**
 * 플레이어 런타임에는 서버가 없다 — 발행된 트리를 클라이언트가 걷기만 한다.
 * AI 를 부르는 두 자리(관리자 저작, 심문 노드)도 브라우저에서 직접 나가는 fetch/SSE라
 * 서버 코드가 필요 없다. 그래서 통째로 정적 export 가 된다.
 *
 * `@anthropic-ai/sdk` 는 API 키 대신 로컬 프로필(~/.config/anthropic)로 인증하는 경로를 갖고 있고,
 * 그 경로에서 `await import('node:fs')` 를 한다. 전부 함수 안의 동적 import 라 브라우저에서는
 * 실행되지 않지만, webpack 은 정적 분석 단계에서 `node:` 스킴을 만나 빌드를 실패시킨다.
 *
 * `resolve.alias` 로는 못 막는다 — webpack 5 는 스킴이 붙은 요청을 리졸버 앞단에서 처리하므로
 * alias 가 적용되기 전에 UnhandledSchemeError 가 난다. 그래서 스킴을 먼저 떼어낸 뒤
 * (`node:fs` → `fs`) fallback 으로 빈 모듈을 물린다. (ownchat/web 과 같은 처리다.)
 *
 * 이 앱은 항상 명시적인 apiKey 를 넘기므로 해당 경로에 진입하지 않는다.
 */
const NODE_BUILTINS_UNUSED_IN_BROWSER = [
  'fs',
  'fs/promises',
  'path',
  'os',
  'crypto',
  'child_process',
  'url',
  'util',
  'stream',
  'buffer',
  'process',
  'http',
  'https',
  'zlib',
  'net',
  'tls',
];

const NODE_SCHEME_RE = new RegExp(`^node:(${NODE_BUILTINS_UNUSED_IN_BROWSER.join('|')})$`);

/**
 * 배포 프로파일 (`lib/profile.ts` 참고).
 *
 * 기본값을 환경에 따라 다르게 두는 이유: dev 로 띄우면 저작 도구가 보여야 하고,
 * 빌드는 **기본이 사용자 배포**여야 한다. 관리자 화면이 실린 빌드가 실수로 공개되는 쪽이
 * 그 반대보다 위험하므로, 위험한 쪽에 명시적인 플래그를 요구한다.
 */
const PROFILE =
  process.env.RPG_PROFILE || (process.env.NODE_ENV === 'development' ? 'admin' : 'player');
const HOSTED = PROFILE === 'hosted';

/**
 * 관리자 화면을 **빌드에서 빼는** 방법.
 *
 * 코드 안에서 조건부로 숨기면 저작 도구 코드가 사용자 번들에 그대로 남는다. 대신 관리자
 * 페이지 파일을 `page.admin.tsx` 로 두고, 관리자 프로파일에서만 `admin.tsx` 를 페이지
 * 확장자로 인정한다. 사용자 빌드에서는 그 파일이 페이지로 인식되지 않으므로 `/admin`
 * 라우트가 생성되지 않고, 그 파일에서만 import 하는 편집기·AI 패널도 번들에 들어가지 않는다.
 */
const pageExtensions =
  PROFILE === 'admin'
    ? ['admin.tsx', 'tsx', 'ts']
    : HOSTED
      ? ['hosted.ts', 'hosted.tsx', 'tsx', 'ts']
      : ['tsx', 'ts'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next dev가 저장소 안에 AGENTS.md/CLAUDE.md를 자동 생성해 작업 트리를 더럽히지 않게 한다.
  agentRules: false,
  // Electron/admin keeps a static bundle. Only the public Vercel profile has server routes.
  ...(HOSTED ? {} : { output: 'export' }),
  poweredByHeader: false,
  pageExtensions,
  env: {
    // 클라이언트 코드가 프로파일을 볼 수 있게 한다 (홈 화면의 링크, 수록 작품 필터)
    NEXT_PUBLIC_RPG_PROFILE: PROFILE,
    NEXT_PUBLIC_RPG_HOSTED: HOSTED ? '1' : '0',
    NEXT_PUBLIC_OWNCHAT_HOSTED: HOSTED ? '1' : '0',
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(NODE_SCHEME_RE, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...Object.fromEntries(NODE_BUILTINS_UNUSED_IN_BROWSER.map((id) => [id, false])),
      };
    }
    return config;
  },
};

export default nextConfig;
