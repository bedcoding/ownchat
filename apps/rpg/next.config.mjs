/**
 * 플레이어 런타임에는 서버도 AI도 없다 — 발행된 트리를 클라이언트가 걷기만 한다.
 * 관리자 저작 화면만 로컬 브리지(127.0.0.1)를 부르는데, 그것도 브라우저에서 직접 나가는
 * fetch/SSE라 서버 코드가 필요 없다. 그래서 통째로 정적 export가 된다.
 *
 * ownchat/web 과 달리 @anthropic-ai/sdk 를 쓰지 않으므로 `node:` 스킴 우회도 필요 없다.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  poweredByHeader: false,
};

export default nextConfig;
