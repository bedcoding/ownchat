# @ownchat/desktop

Electron 데스크톱 앱. **내 Claude 구독 요금으로** 쓰는 경로다 — 대화마다 종량제로 청구되지 않는다.

> 구독에는 5시간 단위 사용량 한도가 있다. "무제한"이 아니라 "추가 비용 없음"이다.

```bash
npm run desktop          # 저장소 루트에서
```

## 웹 버전과 무엇이 다른가

렌더러와 메인 프로세스가 같은 앱 안에 있으므로 **IPC로 직접** 이야기한다.
그래서 호스팅 웹에 필요했던 것들이 전부 사라진다:

| | 호스팅 웹 + 브리지 | 데스크톱 앱 |
|---|---|---|
| 로컬 HTTP 서버 | 필요 | **없음** |
| 포트 · CORS · Host 검사 | 필요 | **없음** |
| 페어링 코드 | 필요 | **없음** (인증할 외부 호출자가 없다) |
| 로그인 코드 입력 위치 | 브리지가 서빙하는 로컬 페이지 | 앱 안 |

유지되는 것: 공식 Claude Code CLI를 구동한다는 사실, 그리고 이 코드가 로그인 자격증명을
저장하지도 읽지도 전송하지도 않는다는 사실.

## 구성

| 파일 | 역할 |
|---|---|
| `src/main.mjs` | 메인 프로세스 — `app://` 프로토콜 서빙 + IPC 핸들러 |
| `src/preload.cjs` | `contextBridge` 로 `window.ownchat` 노출 |
| `scripts/build-main.mjs` | esbuild로 메인을 한 파일로 번들 |
| `electron-builder.yml` | 패키징 설정 |
| `build/entitlements.mac.plist` | macOS 서명본에서 자식 프로세스를 띄우기 위한 권한 |

## IPC 표면

`window.ownchat` 으로 노출된다. 모든 인자는 메인 프로세스에서 다시 검증한다 —
렌더러를 신뢰 경계로 취급하지 않는다.

| 함수 | 설명 |
|---|---|
| `isDesktop` | 렌더러가 데스크톱 여부를 판별하는 표식 |
| `status(opts?)` | CLI 탐색 결과 + 로그인 상태 (`claude auth status`, 무료) |
| `login()` | 공식 CLI 로그인 흐름 시작 (브라우저가 열린다) |
| `loginState()` | 진행 상태 + 로그인 완료 여부 |
| `submitLoginCode(code)` | 브라우저가 보여준 코드를 CLI stdin으로 전달 |
| `cancelLogin()` | 로그인 흐름 취소 |
| `openExternal(url)` | https URL을 OS 기본 브라우저로 (앱 안에서 열지 않는다) |
| `chat(payload, onEvent)` | 대화 한 턴. `{ done, abort }` 를 돌려준다 |

`chat` 의 `onEvent` 로 오는 것: `meta` → (`thinking` \| `delta` \| `notice`)* → `done` \| `error`.

## 세 가지 반드시 지킬 것

1. **`file://` 로 렌더러를 띄우지 마라.** origin이 불안정해 **localStorage가 유지되지 않는다.**
   `app://` 커스텀 스킴 + `registerSchemesAsPrivileged` 를 쓴다.
2. **프리로드는 `.cjs` 여야 한다.** `sandbox: true` 에서 ESM 프리로드는 로드되지 않는다.
3. **`package.json` 에 `dependencies` 를 추가하지 마라.** electron-builder의 프로덕션 의존성
   설치 단계가 워크스페이스 심볼릭 링크를 풀려다 자기 바이너리(`app-builder-bin`)를 지운다.
   그래서 메인을 esbuild로 번들해 의존성을 0으로 유지한다.

자세한 배경과 나머지 함정은 [../../docs/STATUS.md](../../docs/STATUS.md) 4장에 있다.

## 패키징

```bash
npm run desktop:pack     # 설치 파일 없이 (dist/win-unpacked 등)
npm run desktop:dist     # 설치 파일까지
```

서명은 아직 설정되어 있지 않다. 없이 빌드하면 Windows SmartScreen · macOS "확인되지 않은
개발자" 경고가 뜬다. 아이콘도 Electron 기본값이다 — `build/icon.ico` · `icon.icns` ·
`icon.png` 를 넣으면 자동으로 잡힌다.

교차 빌드는 서명 때문에 제약이 크다. 각 OS에서 빌드하는 게 정석이고, 보통 CI 매트릭스로 한다.
