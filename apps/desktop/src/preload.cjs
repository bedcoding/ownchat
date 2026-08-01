const { contextBridge, ipcRenderer } = require('electron');

/**
 * 렌더러에 노출하는 유일한 창구.
 *
 * contextIsolation + sandbox 가 켜져 있으므로 렌더러는 Node에 접근할 수 없다.
 * 여기서 명시적으로 넘긴 함수들만 쓸 수 있고, 각 함수는 메인 프로세스에서
 * 인자를 다시 검증한다 — 렌더러를 신뢰 경계로 취급하지 않는다.
 *
 * 프리로드는 CommonJS여야 한다(.cjs). sandbox:true 에서 ESM 프리로드는 로드되지 않는다.
 */

let counter = 0;
function nextId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

contextBridge.exposeInMainWorld('ownchat', {
  /** 렌더러가 "데스크톱 앱에서 도는 중"을 판별하는 표식 */
  isDesktop: true,

  status: (opts) => ipcRenderer.invoke('ownchat:status', opts ?? {}),
  login: () => ipcRenderer.invoke('ownchat:login'),
  loginState: () => ipcRenderer.invoke('ownchat:loginState'),
  submitLoginCode: (code) => ipcRenderer.invoke('ownchat:loginCode', code),
  cancelLogin: () => ipcRenderer.invoke('ownchat:loginCancel'),
  openExternal: (url) => ipcRenderer.invoke('ownchat:openExternal', url),

  /**
   * 대화 한 턴. onEvent로 스트리밍 이벤트가 들어오고, done이 resolve되면 끝난 것이다.
   * abort()를 부르면 메인이 claude 프로세스 트리를 정리한다.
   */
  chat(payload, onEvent) {
    const id = nextId();
    const listener = (_event, msg) => {
      if (msg && msg.id === id) onEvent(msg.event);
    };
    ipcRenderer.on('ownchat:chat:event', listener);

    const done = ipcRenderer
      .invoke('ownchat:chat', { ...payload, id })
      .finally(() => ipcRenderer.off('ownchat:chat:event', listener));

    return {
      done,
      abort: () => ipcRenderer.send('ownchat:chat:abort', id),
    };
  },
});
