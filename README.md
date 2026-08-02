# ownchat

추론 비용이 **서비스가 아니라 사용자 쪽에서** 발생하는 AI 채팅.

두 형태로 쓸 수 있고, 둘 다 **서비스 운영자의 AI 비용이 0**이다.

| | 데스크톱 앱 | 호스팅 웹 |
|---|---|---|
| 설치 | 인스톨러 | 없음 |
| 비용 | **내 Claude 구독 요금 안에서** (추가 과금 없음) | 내 API 키로 사용량만큼 |
| Windows / macOS / Linux | ✅ | ✅ |
| iPhone / Android | ❌ | ✅ |

> **"무제한"이 아니다.** Claude Pro/Max에는 5시간 단위 사용량 한도가 있고, 이 앱은 그 한도를
> 늘리거나 우회하지 않는다. 정확히 말하면 "구독 요금 외에 **따로 청구되는 금액이 없다**"는 뜻이다.
> 한도에 걸리면 앱이 그렇게 표시하고, 창이 초기화될 때까지 기다리거나 API 키 모드로 넘어가면 된다.

> **왜 폰에서는 구독을 못 쓰나?** "구독으로 쓴다"는 것은 결국 내 기기에서 공식 Claude Code를
> 돌린다는 뜻이고, 그건 Node.js CLI라 폰에서 돌지 않는다. 폰에서 서버로 구독 토큰을 보내는 것은
> [Anthropic이 금지한 구조](docs/POLICY.md)다. 스택의 한계가 아니라 정책의 결과다.

호스팅 웹을 **PC에서** 쓸 때는 로컬 브리지(`npx @ownchat/bridge`)를 띄우면 구독으로도 쓸 수 있다.

---

## 이 저장소에는 앱이 둘 있다

같은 원칙(추론 비용을 서비스가 떠안지 않는다) 위에 올린 서로 다른 물건이다.

| | ownchat | rpg |
|---|---|---|
| 무엇 | AI 채팅 (데스크톱 앱 + 웹) | 회차 진행형 선택지 게임 + 저작 도구 |
| 플레이 중 AI | 매 턴 호출 | **호출 없음** |
| AI 를 쓰는 시점 | 대화할 때마다 | 관리자가 트리를 만들 때 한 번 |
| 실행 | `npm run desktop` | `npm run rpg` |

`apps/rpg` 는 웹툰 한 회차를 선택지 트리 한 편으로 만드는 실험이다. 플레이어 런타임에는
네트워크 호출이 한 줄도 없고, AI 는 관리자가 회차 이미지에서 트리 초안을 뽑을 때만 돈다.
자세한 것은 [apps/rpg/README.md](apps/rpg/README.md).

---

## 구조

```
브라우저/렌더러 ──┬── IPC              → 내 PC의 Claude Code   (데스크톱 앱)
                  ├── 127.0.0.1:4319   → 내 PC의 Claude Code   (웹 + 로컬 브리지)
                  └── api.anthropic.com                        (본인 API 키)

  ownchat 서버 ── 정적 파일만 제공. 추론 경로에 없다.
```

UI는 하나다. 전송 계층만 3개고, 실행 환경에 따라 자동으로 갈린다.

| 폴더 | 역할 |
|---|---|
| `packages/core` | Claude Code CLI를 구동하는 순수 로직 (HTTP도 UI도 모른다) |
| `apps/desktop` | Electron 앱 — 구독 요금 경로 |
| `apps/web` | Next.js UI — 데스크톱 렌더러 겸 호스팅 웹사이트 |
| `apps/rpg` | 회차 진행형 선택지 게임 + 관리자 저작 도구 (플레이 중 AI 호출 0) |
| `packages/bridge` | 호스팅 웹에서 구독을 쓰기 위한 로컬 HTTP 브리지 |

---

## 빠르게 써보기

```bash
npm install
```

### 데스크톱 앱

```bash
npm run desktop
```

Claude Code가 없으면 먼저 `npm i -g @anthropic-ai/claude-code`. **로그인은 앱 안의 버튼으로**
한다 — 터미널을 열 필요가 없다.

### 호스팅 웹 + 브리지

```bash
npm run bridge      # 터미널 1 — 페어링 코드가 찍힌다
npm run dev:web     # 터미널 2 — http://localhost:3000
```

설정에 페어링 코드를 붙여넣으면 구독으로 동작한다. 브리지 없이 쓰려면 API 키만 넣으면 된다.

---

## 명령

| 명령 | 설명 |
|---|---|
| `npm run desktop` | 렌더러 빌드 + 데스크톱 앱 실행 |
| `npm run desktop:dev` | dev 서버에 붙은 데스크톱 앱 (UI 고치면서 볼 때) |
| `npm run desktop:pack` | 설치 파일 없이 패키징 (`apps/desktop/dist/`) |
| `npm run desktop:dist` | 설치 파일까지 빌드 |
| `npm run dev:web` | 웹 UI 개발 서버 |
| `npm run build` | 웹 UI 정적 빌드 (`apps/web/out` — 렌더러 겸 배포물) |
| `npm run rpg` | 선택지 게임 개발 서버 (`localhost:3200`) |
| `npm run rpg:build` | 선택지 게임 정적 빌드 |
| `npm run bridge` | 로컬 브리지 |
| `npm run bridge:token` | 페어링 코드 출력 |

---

## 문서

| 문서 | 내용 |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | **작업 현황·인수인계** — 검증된 것, 남은 일, 함정 목록 |
| [docs/POLICY.md](docs/POLICY.md) | 정책 근거와 구조 결정 (왜 이렇게 만들었나) |
| [packages/bridge/README.md](packages/bridge/README.md) | 브리지 API·옵션·보안 |
| [apps/rpg/README.md](apps/rpg/README.md) | 선택지 게임 — 실행법·구조 |
| [apps/rpg/docs/STATUS.md](apps/rpg/docs/STATUS.md) | 선택지 게임 작업 현황·함정 |
| [apps/rpg/docs/DEVQUEST.md](apps/rpg/docs/DEVQUEST.md) | 샘플 시나리오 9화 전체 설계 |

**이어서 작업하는 사람은 [docs/STATUS.md](docs/STATUS.md) 부터 읽으세요.**
함정 목록(4장)을 모르면 같은 데서 시간을 버립니다.
선택지 게임 쪽만 볼 거면 [apps/rpg/docs/STATUS.md](apps/rpg/docs/STATUS.md) 로 바로 가면 됩니다.

---

## 알아둘 것

- **브리지는 사용자 PC에서만 돈다.** 서버에 올려서 여러 사용자의 구독을 대신 태우면
  그 순간 [금지된 구조](docs/POLICY.md)가 된다.
- 채팅용이라 **파일·셸·에이전트 도구를 전부 차단**한다. 대화 내용에 섞여 들어온 지시로
  로컬 파일이 건드려지는 일은 없다.
- 로그인 여부는 `claude auth status --json` 으로 확인한다. **토큰을 소모하지 않는다.**
- 페어링 코드·API 키는 이 기기에만 저장되고, 요청은 기기에서 직접 나간다. 서버는 대화 내용도
  자격증명도 받지 않는다.
- 배포용 서명(Windows 인증서, macOS 공증)은 아직 없다. 지금 빌드하면 OS 경고가 뜬다 —
  [STATUS.md 5장 A](docs/STATUS.md) 참조.
