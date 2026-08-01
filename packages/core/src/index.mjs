/**
 * 사용자 PC의 Claude Code를 구동하는 공통 계층.
 *
 * 이 패키지는 HTTP도 UI도 모른다. 두 곳에서 쓴다:
 *   - apps/desktop  Electron 메인 프로세스 (IPC로 렌더러에 연결)
 *   - packages/bridge  호스팅 웹 UI용 로컬 HTTP 브리지
 *
 * 어느 쪽이든 Anthropic으로 나가는 요청은 공식 Claude Code CLI가 만든다.
 * 이 코드는 로그인 자격증명을 저장하지도, 읽지도, 전송하지도 않는다.
 */

export { LoginFlow, authStatus, invalidateAuthCache } from './auth.mjs';
export {
  explainFailure,
  isAllowedModel,
  isValidSessionId,
  resetCliCache,
  resolveCli,
  runTurn,
} from './claude-cli.mjs';
export { PERSONA, buildPrompt } from './prompt.mjs';
export { killTree, shellSafe } from './spawn-util.mjs';
