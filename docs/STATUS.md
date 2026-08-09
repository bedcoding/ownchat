# 작업 현황 · 인수인계

> 이 문서는 **다음 사람이 이어서 작업하기 위한 것**이다. 무엇이 되고, 무엇이 검증됐고,
> 무엇이 남았고, 어디서 발을 헛디디게 되는지를 적는다.
> 왜 이런 구조인지에 대한 근거는 [POLICY.md](POLICY.md)에 따로 있다.

최종 갱신: 2026-08-06

## 한 줄 요약

두 형태 모두 동작한다 — **데스크톱 앱**(내 Claude 구독 요금으로) 과 **호스팅 웹**(설치 0, 본인 API 키).
UI는 하나이고, 전송 계층만 3개다.

---

## 1. 구조

```
packages/core/       Claude Code CLI를 구동하는 순수 로직. HTTP도 UI도 모른다
  claude-cli.mjs       CLI 탐색 · 인자 조립 · NDJSON 스트림 파싱 · 실패 사유 해석
  auth.mjs             claude auth status(무료 로그인 체크) · LoginFlow(로그인 흐름)
  prompt.mjs           채팅 페르소나 (첫 턴 stdin 앞에 붙는다)
  spawn-util.mjs       Windows 따옴표 처리 · 프로세스 트리 종료

apps/desktop/        Electron 앱  ← 구독 요금 경로
  src/main.mjs         메인 프로세스: app:// 프로토콜 서빙 + IPC 핸들러
  src/preload.cjs      contextBridge로 window.ownchat 노출 (반드시 .cjs)
  scripts/build-main.mjs  esbuild로 메인을 한 파일로 번들
  electron-builder.yml    패키징 설정

apps/rpg/            통합 Next.js UI  ← Electron 렌더러 + Vercel 웹
  lib/chat/providers/  자유 채팅 전송 계층 4개
    desktop.ts           IPC        (데스크톱 앱 안)
    bridge.ts            HTTP/SSE   (관리자 웹 + 로컬 브리지)
    apikey.ts            직접 호출  (BYOK, 어디서든)
    openai.ts            서버 호출  (Vercel hosted 프로필)
    index.ts             어느 것을 쓸지 결정 (resolveProvider)
  app/chat/            채팅 UI
  app/play/            버튼형 스토리 + 자유 심문
  app/admin/           관리자 저작 도구
  app/tour/            실제 화면 기반 제품 투어
  app/api/             PostgreSQL/OpenAI 서버 경로

packages/bridge/      호스팅 웹에서 구독을 쓰기 위한 로컬 HTTP 브리지
  src/server.mjs         HTTP + SSE + CORS + 토큰 검사
  src/token.mjs          페어링 코드
  src/login-page.mjs     로그인 코드 입력 페이지(브리지가 직접 서빙)
```

### 왜 전송 계층이 3개인가

같은 질문("내 PC의 Claude Code를 UI에 어떻게 연결하나")에 실행 환경마다 답이 다르다.

| 환경 | 전송 | 페어링 코드 | 비용 |
|---|---|---|---|
| 데스크톱 앱 | IPC | 불필요 (외부 호출자가 없다) | 구독 정액 |
| 호스팅 웹 + 로컬 브리지 | HTTP/SSE | 필요 | 구독 정액 |
| 어디서든 (폰 포함) | api.anthropic.com 직접 | 해당 없음 | 종량제 |

UI는 `isDesktop()`(= `window.ownchat` 존재 여부) 하나로 갈린다.

### 모바일은 따로 개발해야 하나

두 질문을 분리해야 한다.

**(가) 폰에서 이 채팅을 쓰는 것 — 이미 된다. 별도 앱 개발이 필요 없다.**
hosted 프로필은 서버의 OpenAI API를 사용하고, 관리자/BYOK 프로필은 브라우저에서
`api.anthropic.com` 을 직접 부른다. 390px 레이아웃과 사이드바 서랍을 검증했다.

폰에서는 UI가 **구독 이야기를 아예 꺼내지 않는다** (`lib/capabilities.ts`).
"터미널에서 `npx @ownchat/bridge` 를 실행하세요"는 폰에서 실행할 수 없는 안내이고,
그런 안내는 도움이 아니라 이탈 사유다. 구체적으로:

- 빈 화면이 "API 키를 넣으면 바로 쓸 수 있습니다" 로 바뀌고, 왜 구독을 못 쓰는지 설명한 뒤
  ① 지금 쓰려면 API 키 ② 구독 요금으로 쓰려면 PC 데스크톱 앱 두 가지만 제시한다
- 설정의 연결 방식이 `API 키` 하나로 줄고, 브리지 주소·페어링 코드·Claude Code 상태줄이 사라진다
- API 키 라벨에서 "(선택)" 이 빠진다 — 이 기기에서는 선택이 아니다
- **존재할 수 없는 `127.0.0.1:4319` 를 폴링하지 않는다.** 20초마다 연결 거부 타임아웃을
  기다리는 것은 배터리 낭비다

판별은 User-Agent가 아니라 능력으로 한다: `(pointer: coarse) && (max-width: 900px)`.
`&&` 인 것이 중요하다 — 터치 노트북은 `pointer: fine` 이라 걸리지 않고, 데스크톱에서 창을
좁게 줄인 경우도 걸리지 않는다. 즉 오분류가 안전한 방향으로만 일어난다.

**(나) 폰에서 구독 요금으로 쓰는 것 — 구조적으로 불가능하다.** 개발 노력의 문제가 아니다.

구독을 쓰는 유일한 합법 경로는 "내 기기에서 공식 Claude Code를 돌리는 것"이고, 그건
Node.js CLI다. iOS는 앱이 임의 코드 인터프리터를 돌리는 것 자체를 제한하고, Android는
Termux로 이론상 가능하지만 일반 사용자에게 배포할 형태가 아니다. 그리고 폰에서 서버로
구독 토큰을 보내는 것은 [금지된 그 구조](POLICY.md)다.

**우회로는 하나 있다(미구현):** 내 PC의 브리지에 내 폰이 접속하는 방식. 같은 사용자가
자기 기기·자기 구독에 접근하는 것이라 "서비스가 대신 라우팅"하는 게 아니다. 다만 이건
5장 C에 적어 둔 대로 구현 과제가 남아 있고, 특히 **https 페이지에서 `http://192.168.x.x`
는 혼합 콘텐츠로 차단된다** — localhost 예외는 LAN IP에 적용되지 않는다. 진짜 TLS가 붙는
터널(Cloudflare Tunnel, Tailscale Funnel)이 필요하다.

---

## 2. 실행 방법

```bash
npm install
```

### 데스크톱 앱

```bash
npm run rpg:build:admin          # 통합 렌더러 정적 export (apps/rpg/out)
npm run start -w @ownchat/desktop
```

개발 중 UI를 고치면서 볼 때는 dev 서버에 붙인다:

```bash
npm run dev:web                          # 터미널 1
npm run dev -w @ownchat/desktop          # 터미널 2 (OWNCHAT_DEV_URL 사용)
```

패키징:

```bash
npm run pack -w @ownchat/desktop   # dist/win-unpacked (설치 파일 없이)
npm run dist -w @ownchat/desktop   # 설치 파일까지
```

### 호스팅 웹 + 브리지

```bash
npm run bridge      # 터미널 1 — 페어링 코드가 찍힌다
npm run dev:web     # 터미널 2 — localhost:3200
```

### 환경변수

| 변수 | 쓰는 곳 | 설명 |
|---|---|---|
| `CLAUDE_CLI_CMD` | 공통 | `claude` 실행 파일 경로 직접 지정 |
| `OWNCHAT_DEV_URL` | desktop | 정적 export 대신 dev 서버를 로드 |
| `OWNCHAT_DEBUG` | desktop | 렌더러 콘솔·로드 결과를 메인 stdout으로 끌어온다 |
| `OWNCHAT_MODEL` | desktop/bridge | 기본 모델 |
| `OWNCHAT_NO_WEB=1` | desktop | 웹 검색·페이지 읽기 도구 차단 |
| `OWNCHAT_PORT` 등 | bridge | `packages/bridge/README.md` 참조 |

---

## 3. 검증된 것

전부 실제로 실행해서 확인한 것만 적는다. 추측은 4장에 따로 적는다.

| 항목 | 방법 | 결과 |
|---|---|---|
| 브리지 → 실제 구독 응답 | 브라우저에서 "대한민국의 수도는?" | **"서울"** (Haiku 4.5, 사고 과정 포함) |
| 데스크톱 → 실제 구독 응답 | Electron 렌더러에서 IPC로 "1+1은?" | **"2"** (meta→thinking×6→delta→done) |
| 세션 재개 | 2턴째 전송 | 같은 sessionId로 `--resume` 사용, 페르소나 재전송 안 함 |
| 로그인 버튼 | 브리지 경로로 클릭 | 브라우저 열림 → 로그인 완료 → `loggedIn: true, authMethod: "claude.ai"` → UI 자동 전환 |
| 무료 로그인 체크 | `claude auth status --json` | 토큰 소모 0 |
| CLI 인자 실측 | 스텁 CLI가 argv를 파일로 기록 | 도구 16개 차단 · `--strict-mcp-config` · `--permission-mode dontAsk` · 격리된 cwd · `ANTHROPIC_API_KEY` 제거 확인 |
| 브리지 보안 | curl | 토큰 없음 401 · 미허용 오리진 403 · 프리플라이트 헤더 정상 |
| 교차 오리진 | 브라우저 localhost:3100 → 127.0.0.1:4319 | 성공 (Private Network Access 포함) |
| localStorage in Electron | 패키징 전 스모크 | `app://` 스킴에서 `true` |
| 프로덕션 빌드 | `next build` | 통과 (정적 export 2개 페이지) |
| Windows 패키징 | `electron-builder --dir` (클린 빌드) | `dist/win-unpacked/ownchat.exe`, 압축 전 270MB |
| 패키징된 앱 실행 | `ownchat.exe` 직접 실행 | asar 안 렌더러 로드 완료 |
| 다크모드·가로스크롤 | 브라우저 | 정상, 콘솔 에러 0 |
| 모바일 레이아웃 (375px) | 브라우저 뷰포트 축소 | 사이드바 서랍: 햄버거로 열기 → 대화 선택 시 자동 닫힘 → 배경 클릭 닫힘. 가로 스크롤 없음 |
| 데스크톱 레이아웃 (1280px) | 브라우저 | 사이드바 상시 표시(260px), 햄버거 숨김 |
| 폰 분기 UI | `isTouchOnlyDevice()` 를 일시적으로 `true` 로 강제 | 빈 화면·설정 모두 API 키 전용으로 바뀜. 브리지·npx·페어링 언급 0회, `127.0.0.1` 요청 0회 |
| 폰 분기 오탐 방지 | 플래그 원복 후 375px 좁은 창 | 폰으로 분류되지 않음(`pointer: fine`), 구독 경로 정상 노출 |
| **브리지 실행** (2026-08-06) | `npm run bridge` → `/health` | `claudeCli.found: true, loggedIn: true, authMethod: "claude.ai"`. 6장 7번 버그를 고친 뒤 |
| **rpg 저작 파이프라인** (2026-08-06) | 브리지 경유로 설정 한 줄 → 트리 초안 | 235초 / 14노드 / 검증 오류 0 · 확률 분기 14건 자동 생성. 자세한 것은 [apps/rpg/docs/STATUS.md](../apps/rpg/docs/STATUS.md) 4장 |

### 검증하지 못한 것

- **macOS / Linux 빌드와 실행.** 이 작업은 Windows에서만 했다. 코드는 플랫폼 분기를 갖고
  있지만(`spawn-util.mjs`, `auth.mjs`) 실제로 돌려본 적이 없다.
- **자동화된 테스트가 하나도 없다.** 위 검증은 전부 수동이다.
- BYOK(API 키) 경로의 실제 응답. 코드는 있고 타입 체크는 통과하지만 키가 없어 호출해 보지 못했다.
  `apps/rpg/lib/chat/providers/apikey.ts` 의 서버측 폴백(`fallbacks: "default"`) 분기가 특히 미검증이다.

---

## 4. 반드시 알아야 할 함정

이 목록은 전부 실제로 부딪혀서 알아낸 것이다. 모르면 같은 데서 시간을 버린다.

### Claude Code CLI

1. **`--bare` 를 쓰면 안 된다.** 문서에 *"Bare mode skips OAuth and keychain reads"* 라고
   적혀 있다. 즉 구독으로 동작하지 않고 `ANTHROPIC_API_KEY`를 요구한다. 이 프로젝트의 전제와 정반대다.
2. **Windows에서 인자에 공백·따옴표를 넣지 마라.** npm 전역 설치본은 `claude.cmd` 이고,
   Node 20.12+는 `shell: true` 없이 `.cmd` 실행을 막는다. 그런데 `shell: true` 는 인자를
   자동으로 따옴표 처리하지 않는다. 그래서 페르소나 같은 긴 텍스트는 **stdin으로** 넣는다
   (`prompt.mjs`). 인자로는 모델 별칭·UUID·쉼표로 이은 도구 목록만 넘긴다.
3. **`--include-partial-messages` 를 못 쓰는 버전이 있다.** 그때는 델타가 오지 않고 완성된
   `assistant` 이벤트만 온다. `assistant` 와 `result` 둘 다 처리하면 **같은 답이 두 번 나간다.**
   `claude-cli.mjs` 의 `state.emitted` 플래그가 이걸 막는다. 건드리지 마라.
4. **실패 사유가 stderr가 아니라 답변 본문으로 온다.** `Not logged in · Please run /login` 이
   stdout의 JSON 이벤트로 흘러나온다. stderr만 보면 `종료코드 1` 밖에 못 본다.
   `explainFailure` 에 `stderr + tail + emittedText` 셋 다 넘기는 이유다.
5. **`claude auth status --json` 은 무료다.** 로그인 여부를 확인하려고 대화를 태우지 마라.
   반대로 `claude -p` 로 프로브를 돌리면 매번 과금된다.
6. **`ANTHROPIC_API_KEY` 가 환경에 있으면 구독보다 우선한다.** "구독으로 쓰는 중"이라고
   표시된 채 종량제로 청구된다. 그래서 자식 프로세스 환경에서 기본적으로 지운다
   (`--keep-env-auth` 로 해제 가능).

### Electron

7. **`file://` 로 렌더러를 띄우면 안 된다.** origin이 불안정해서 **localStorage가 유지되지 않는다.**
   이 앱은 설정·대화를 전부 localStorage에 두므로 치명적이다. `app://` 커스텀 스킴 +
   `registerSchemesAsPrivileged({ standard: true, secure: true })` 를 쓴다.
8. **프리로드는 `.cjs` 여야 한다.** `sandbox: true` 에서 ESM 프리로드는 로드되지 않는다.
9. **electron-builder + npm workspaces 조합이 자기 바이너리를 지운다.** 앱에 워크스페이스
   의존성(`@ownchat/core`)이 있으면 "installing production dependencies" 단계가 루트
   node_modules를 재설치하면서 `app-builder-bin` 을 날린다. 그래서 메인 프로세스를
   **esbuild로 번들해 프로덕션 의존성을 0으로** 만들었다(`scripts/build-main.mjs`).
   `package.json` 에 `dependencies` 를 다시 추가하면 이 문제가 되살아난다.
10. **Electron이 살아 있으면 `npm install` 이 EBUSY로 실패한다.** 그리고 단일 인스턴스 락
    때문에 새 인스턴스는 조용히 종료된다(출력이 텅 비면 이걸 의심하라).
    `Get-Process electron, ownchat | Stop-Process -Force` 로 정리한다.

### 웹 빌드

11. **webpack의 `node:` 스킴은 `resolve.alias` 로 못 막는다.** Anthropic SDK가
    `await import('node:fs')` 를 하는데(전부 함수 안의 동적 import라 브라우저에서는 실행되지
    않는다), webpack은 정적 분석에서 스킴을 만나 빌드를 실패시킨다. `alias`는 리졸버 앞단에서
    처리되므로 무효다. `NormalModuleReplacementPlugin` 으로 스킴을 먼저 떼고 `resolve.fallback`
    으로 빈 모듈을 물려야 한다 (`apps/rpg/next.config.mjs`).

### CSS

12. **미디어쿼리는 특정도를 올리지 않는다.** `@media` 블록을 같은 선택자의 기본 규칙보다
    **위에** 쓰면, 아래에 나온 기본 규칙이 이겨서 오버라이드가 조용히 무효가 된다.
    실제로 `.sidebar { display: none }` 이 이 이유로 안 먹어서 폰에서 사이드바가 화면을
    덮었다. **반응형 블록은 `globals.css` 맨 끝에 모아 둔다** — 그렇게 주석도 달아 뒀다.

### 브라우저 자동화로 테스트할 때

13. **`form_input` 으로 체크박스를 토글하면 React의 onChange가 걸리지 않는다.** DOM 값만
    바뀌고 상태는 그대로다. 실제 클릭을 써야 한다. (한 번 이걸로 "체크박스가 동작하지 않는다"고
    잘못 판단했다.)
14. **Browser 패널이 화면에 표시되지 않으면 프레임을 합성하지 않아 CSS transition이 진행되지
    않는다.** `getComputedStyle` 이 전환 시작값에 영원히 멈춘 값을 돌려주므로, 애니메이션이
    걸린 요소를 검사하면 "동작하지 않는다"고 오판하게 된다. 같은 이유로 스크린샷도 타임아웃된다.
    검사할 때는 `*{transition:none!important}` 를 주입해 최종 상태만 보라.
    (사이드바 서랍을 이걸로 한 번 오판했다.)

15. **Browser 패널의 `mobile` 프리셋은 뷰포트만 바꾸고 터치 포인터를 흉내 내지 않는다.**
    `(pointer: coarse)` 가 계속 false라 폰 분기를 그 방식으로는 검증할 수 없다.
    `isTouchOnlyDevice()` 를 일시적으로 `true` 로 강제해서 확인하고 원복하라.
16. **dev 서버가 깨진 중간 저장 상태를 캐시한다.** 편집 도중 한 번 컴파일이 실패하면
    `tsc`·`next build` 가 통과해도 dev 서버는 계속 그 구문 오류를 보여준다.
    dev 서버를 죽이고 `.next` 를 지우고 다시 띄워야 한다. 이걸 모르면 있지도 않은 문법
    오류를 쫓게 된다.

### 표현

19. **"무제한 / 제한 없이" 라고 쓰지 마라.** Pro/Max에는 5시간 단위 사용량 한도가 있어
    사실이 아니고, 공개 문서에서 그렇게 쓰면 한도 우회를 권하는 프레이밍이 된다 — Anthropic
    정책이 문제 삼는 "ordinary, individual usage" 전제와 정면으로 부딪힌다.
    쓸 표현: "구독 요금 안에서", "따로 청구되는 금액이 없다", "종량제 과금 없음".
    ([POLICY.md](POLICY.md) → 표현 주의)

### 빌드·패키징

20. **`next build` 와 `electron-builder` 를 연달아 돌리면 파일 락으로 한 번 실패할 수 있다.**
    앞선 패키징이나 실행 중인 앱이 `out/`·`dist/` 핸들을 잡고 있을 때다. 같은 명령을 다시
    돌리면 통과한다. 실패가 반복되면 `Get-Process electron, ownchat | Stop-Process -Force`.
21. **패키징 크기는 압축 전 270MB다.** Chromium을 같이 넣기 때문이고 Electron의 정상 범위다.
    NSIS 설치 파일은 이보다 훨씬 작아진다. 이게 문제가 되면 Tauri를 검토해야 하는데, 그러면
    `packages/core` 를 Rust로 다시 쓰거나 Node를 사이드카로 넣어야 해서 용량 이점이 줄어든다.

---

## 5. 남은 일

우선순위 순.

### A. 배포 전에 반드시

- [ ] **앱 아이콘.** 지금은 Electron 기본 아이콘이다. `apps/desktop/build/` 에
      `icon.ico`(Windows, 256px 포함), `icon.icns`(macOS), `icon.png`(Linux, 512px) 를 넣으면
      electron-builder가 자동으로 집는다.
- [ ] **코드사이닝.** 없으면 Windows SmartScreen 경고, macOS "확인되지 않은 개발자" 경고가 뜬다.
      - Windows: 코드사이닝 인증서 (EV 권장). `CSC_LINK` / `CSC_KEY_PASSWORD` 환경변수.
      - macOS: Apple Developer 계정($99/년) + **공증(notarization)** 필요.
        `entitlements.mac.plist` 는 이미 넣어 뒀다 — `disable-library-validation` 이 있어야
        서명이 다른 `claude` 실행 파일을 자식으로 띄울 수 있다.
- [ ] **macOS / Linux에서 빌드·실행 검증.** 교차 빌드는 서명 때문에 제약이 크다. 각 OS에서
      빌드하는 게 정석이고, 보통 CI(GitHub Actions의 matrix)로 한다.
- [ ] **BYOK 경로 실제 호출 검증.** 특히 `apikey.ts` 의 `fallbacks: "default"` 분기.
      400이 나면 `isBetaParamRejection` 이 잡아 폴백 없이 재시도하게 되어 있는데, 실제로
      그 경로를 타 본 적이 없다.

### B. 제품으로서 빠진 것

- [ ] **마크다운 렌더링.** 지금 답변은 순수 텍스트다(`MessageList.tsx`). 코드블록 하이라이팅,
      복사 버튼이 없다. 렌더러를 넣을 때 **XSS를 조심하라** — 현재는 텍스트 노드로만 그려서
      안전하다. 마크다운을 넣는 순간 그 보장이 사라진다.
- [ ] **대화 저장소 교체.** localStorage는 보통 5~10MB에서 막힌다. 데스크톱 앱은 파일이나
      SQLite로 옮기는 게 맞다(`storage.ts` 를 IPC 뒤로 숨기면 된다). 백업·내보내기도 없다.
- [x] ~~**모바일 레이아웃.**~~ 사이드바를 서랍으로 만들고 상단바에 햄버거를 넣었다.
      (원래 CSS 순서 오류로 사이드바 숨김 자체가 안 먹고 있었다 — 4장 12번 참조.)
      남은 것: 실제 기기에서의 터치 타겟 크기·안전영역(노치) 확인.
- [ ] **첨부파일·이미지 입력.** CLI는 지원하지만 UI에 경로가 없다.
- [ ] **비용·사용량 표시.** `done` 이벤트로 `costUsd` 를 이미 받고 있는데 화면에 쓰지 않는다.
      BYOK 모드에서 특히 필요하다.
- [ ] **대화 검색**, **프롬프트 프리셋**, **대화 내보내기**.
- [ ] **자동 업데이트** (`electron-updater`). 데스크톱 앱이면 사실상 필수다.

### C. 정리하면 좋은 것

- [ ] **폰 → 내 PC 브리지 접속** (선택). 폰에서도 구독으로 쓰고 싶다면 이것뿐이다.
      필요한 작업: (1) 브리지가 루프백 외 인터페이스에도 바인딩하는 옵션, (2) **TLS** —
      https 페이지에서 `http://192.168.x.x` 는 혼합 콘텐츠로 차단되므로(localhost 예외는
      LAN IP에 적용 안 됨) Cloudflare Tunnel / Tailscale Funnel 같은 터널이 사실상 필수,
      (3) 페어링 코드 TTL + 재페어링 — 인터넷에 노출되는 순간 그 코드가 내 구독 앞의
      유일한 방벽이 된다, (4) PC가 켜져 있어야 한다는 제약 안내.
      **이걸 하기 전에 아래 TTL 항목을 먼저 처리해야 한다.**
- [ ] **PWA** (선택). `manifest.json` + 아이콘 + 서비스워커를 넣으면 폰 홈 화면에 설치되어
      앱처럼 열린다. 모바일 BYOK 경험이 크게 좋아지고 비용이 거의 안 든다.
- [ ] **페어링 코드 TTL.** 지금은 만료가 없다. 호스팅 웹 도메인이 XSS를 당하면 코드가
      탈취되어 구독을 무단 소모할 수 있다(로그인 방식과 무관한 위험). 12시간 정도로 제한하고
      재페어링을 요구하는 게 맞다.
- [ ] **자동화된 테스트.** 최소한 `claude-cli.mjs` 의 NDJSON 파서와 `resolveProvider` 의
      결정 표는 단위 테스트가 가능하다. 스텁 CLI 패턴이 잘 먹혔으니(4장 참조) 그걸 고정
      픽스처로 만들면 된다.
- [ ] **데스크톱 앱에서 로그인 코드 입력 위치 재검토.** 현재는 앱 안에서 받는다. 렌더러가
      로컬 파일만 로드하고 엄격한 CSP가 걸려 있어 외부로 나갈 경로가 없다는 판단이다.
      더 보수적으로 가려면 터미널 창을 띄우는 방식이 있다(feedback-radar 프로젝트가 그렇게 한다).
      트레이드오프는 [POLICY.md](POLICY.md) 4번에 적어 뒀다.
- [ ] **`packages/bridge` 를 npm에 퍼블리시할지 결정.** `@ownchat/core` 를 의존하므로
      둘 다 퍼블리시하거나 번들해야 한다. 데스크톱 앱이 주력이면 브리지는 개발자용 옵션으로
      남겨도 된다.

---

## 6. 이 작업 중에 잡은 버그

기록해 두는 이유: 회귀하기 쉬운 것들이다.

1. **응답 이중 출력** — `--include-partial-messages` 가 안 먹는 CLI 버전에서 `assistant` 와
   `result` 이벤트가 같은 텍스트를 두 번 내보냈다. `state.emitted` 로 해결.
2. **실패 사유 유실** — CLI가 `Not logged in` 을 답변 본문으로 보내서 `not_logged_in` 을
   일반 오류로 처리했다. 실패 detail에 본문까지 포함하도록 수정.
3. **webpack `node:` 스킴 빌드 실패** — `resolve.alias` 로는 안 막혀서
   `NormalModuleReplacementPlugin` 으로 전환.
4. **`Number(process.env.X) ?? default`** — `Number(undefined)` 는 `NaN` 이라 `??` 로 걸러지지
   않는다. `config.mjs` 의 포트 파싱에 있었다.
5. **`env: { ..., KEY: undefined }`** — 플랫폼에 따라 문자열 `"undefined"` 가 된다.
   `delete` 로 지워야 한다.
6. **electron-builder가 자기 바이너리를 삭제** — 4장 9번.
7. **브리지 진입점이 `core` 로 옮겨진 모듈을 상대 경로로 import** (2026-08-06 수정) —
   `bin/ownchat-bridge.mjs` 가 `../src/claude-cli.mjs` 를 불렀는데 그 파일은 `packages/core` 에 있다.
   `server.mjs` 는 `@ownchat/core/claude-cli` 로 올바르게 쓰고 있어서 눈에 안 띄었고, 결과적으로
   **`npm run bridge` 가 아예 실행되지 않는 상태였다.** core 분리 리팩터링에서 bin 만 놓친 것.
   → 회귀 방지: 브리지를 고친 뒤에는 `npm run bridge:token` 이 코드를 출력하는지 한 번 확인한다.
