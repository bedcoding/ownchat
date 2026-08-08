/**
 * @anthropic-ai/sdk 는 API 키 대신 로컬 프로필(~/.config/anthropic)로 인증하는 경로를 갖고 있고,
 * 그 경로에서 `await import('node:fs')` 를 한다. 전부 함수 안의 동적 import라 브라우저에서는
 * 실행되지 않지만, webpack은 정적 분석 단계에서 `node:` 스킴을 만나 빌드를 실패시킨다.
 *
 * `resolve.alias`로는 못 막는다 — webpack 5는 스킴이 붙은 요청을 리졸버 앞단에서 처리하기 때문에
 * alias가 적용되기 전에 UnhandledSchemeError가 난다. 그래서 스킴을 먼저 떼어낸 뒤(`node:fs` → `fs`)
 * fallback으로 빈 모듈을 물린다.
 *
 * 이 앱은 항상 명시적인 apiKey를 넘기므로 해당 경로에 진입하지 않는다.
 * 클라이언트 번들에만 적용하고 서버 번들은 건드리지 않는다.
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
const HOSTED = process.env.OWNCHAT_HOSTED === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * 이 UI에는 서버 코드가 한 줄도 없다 — 모든 컴포넌트가 클라이언트 컴포넌트고,
   * 추론 요청은 브라우저에서 로컬 브리지나 api.anthropic.com 으로 직접 나간다.
   * 그래서 정적으로 내보낼 수 있고, 그 결과물 하나가 두 곳에 쓰인다:
   *   - 호스팅 웹사이트
   *   - Electron 데스크톱 앱의 렌더러 (app:// 커스텀 스킴으로 서빙)
   */
  ...(HOSTED ? {} : { output: 'export' }),
  // route.hosted.ts는 서버 프로필에서만 App Router 라우트로 인식된다.
  pageExtensions: HOSTED ? ['hosted.ts', 'hosted.tsx', 'ts', 'tsx'] : ['ts', 'tsx'],
  env: {
    NEXT_PUBLIC_OWNCHAT_HOSTED: HOSTED ? '1' : '0',
  },
  // Electron이 app://ownchat/index.html 로 로드하므로 자산 경로가 절대 경로여도 된다.
  poweredByHeader: false,
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
