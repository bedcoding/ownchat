import { spawn } from 'node:child_process';

/** shell:true로 실행할 때 공백 있는 경로가 여러 인자로 쪼개지지 않게 한다 */
export function shellSafe(cmd) {
  const needsQuote = process.platform === 'win32' && /\s/.test(cmd) && !cmd.startsWith('"');
  return needsQuote ? `"${cmd}"` : cmd;
}

/**
 * Windows는 shell:true라 자식이 cmd.exe이고 claude 본체는 손자다.
 * child.kill()은 cmd.exe만 종료해 손자가 고아로 남으므로 트리 전체를 종료한다.
 */
export function killTree(child) {
  if (process.platform === 'win32' && child.pid) {
    // spawn 실패는 예외가 아니라 'error' 이벤트로 온다. 리스너가 없으면
    // taskkill이 없는 환경에서 uncaughtException이 되어 브리지가 통째로 죽는다.
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    killer.on('error', () => child.kill());
    return;
  }
  child.kill();
}
