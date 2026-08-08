# ownchat

추론 비용이 **서비스가 아니라 사용자 쪽에서** 발생하는 AI 채팅.

기존 로컬 실행과 공모전용 OpenAI 호스팅 데모를 함께 지원한다.

| | 데스크톱 앱 | 호스팅 웹 |
|---|---|---|
| 설치 | 인스톨러 | 없음 |
| 비용 | **내 Claude 구독 요금 안에서** (추가 과금 없음) | 내 API 키 또는 서버의 OpenAI 데모 한도 |
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
| 플레이 중 AI | 매 턴 호출 | **대부분 호출 없음** (심문 노드만 예외) |
| AI 를 쓰는 시점 | 대화할 때마다 | 관리자가 트리를 만들 때 |
| 실행 | `npm run desktop` | `npm run rpg` |

`apps/rpg` 는 웹툰 한 회차를 선택지 트리 한 편으로 만드는 실험이다. 관리자가 **설정 한 줄**을
넣으면 내 Claude 가 트리 초안(노드·선택지·확률·엔딩)을 만들고, 사람이 고쳐서 발행한다.
플레이어는 그 트리를 걷기만 하므로 런타임 AI 비용이 0이고 오프라인에서도 돈다.

예외가 하나 있다 — **심문 노드**를 쓴 작품은 그 노드에서만 런타임 AI 가 필요하고, 그것도 사용자
기기에서 직접 나간다(이 저장소의 원칙 그대로). 작품이 어느 쪽인지는 데이터에서 판정해 목록에
배지로 표시한다. 자세한 것은 [apps/rpg/README.md](apps/rpg/README.md).

---

## 구조

```
브라우저/렌더러 ──┬── IPC              → 내 PC의 Claude Code   (데스크톱 앱)
                  ├── 127.0.0.1:4319   → 내 PC의 Claude Code   (웹 + 로컬 브리지)
                  ├── api.anthropic.com                        (본인 API 키)
                  └── /api/openai/chat → api.openai.com        (공모전 호스팅 프로필)

  ownchat 서버 ── 정적 파일만 제공. 추론 경로에 없다.
```

UI는 하나다. 전송 계층만 3개고, 실행 환경에 따라 자동으로 갈린다.

| 폴더 | 역할 |
|---|---|
| `packages/core` | Claude Code CLI를 구동하는 순수 로직 (HTTP도 UI도 모른다) |
| `apps/desktop` | Electron 앱 — 구독 요금 경로 |
| `apps/web` | Next.js UI — 데스크톱 렌더러 겸 호스팅 웹사이트 |
| `apps/rpg` | 회차 진행형 선택지 게임 + 관리자 저작 도구 (플레이 중 AI 호출 0, 심문 노드만 예외) |
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

### 공모전용 OpenAI 호스팅 데모

`apps/web/.env.local.example`을 참고해 `apps/web/.env.local`에 다음 값을 넣는다.

```env
OWNCHAT_HOSTED=1
OPENAI_API_KEY=sk-...
OWNCHAT_DEMO_TOKEN=관람자에게-공유할-별도-접근-코드
OPENAI_MODEL=gpt-5.4-mini
```

```bash
npm run dev:hosted       # 개발
npm run build:hosted     # 배포 빌드
npm run start:hosted     # 빌드 실행
```

`OPENAI_API_KEY`는 서버에서만 읽으며 브라우저 번들·localStorage로 내려가지 않는다. 관람자는 API 키 대신
`OWNCHAT_DEMO_TOKEN` 값만 입력한다. 기본 모델은 일일 무료 토큰 대상인 `gpt-5.4-mini`다. IP당 10분 30회,
출력 2,048토큰, 서버 프로세스 기준 일일 추정 200만 토큰으로 제한한다(`OWNCHAT_RATE_LIMIT`,
`OWNCHAT_DAILY_TOKEN_BUDGET`으로 조정 가능).

프로세스 재시작이나 서버리스 다중 인스턴스에서는 일일 카운터가 초기화될 수 있다. 따라서 OpenAI 프로젝트에도
별도의 사용 예산/알림을 설정해야 한다. 무료 한도를 넘는 사용량은 계정의 표준 요금으로 과금될 수 있다.

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
| `npm run dev:hosted` | OpenAI 서버 라우트를 포함한 공모전 데모 개발 서버 |
| `npm run build:hosted` | OpenAI 서버 라우트를 포함한 배포 빌드 |
| `npm run start:hosted` | 공모전 데모 빌드 실행 |
| `npm run rpg` | 선택지 게임 개발 서버 (`localhost:3200`) |
| `npm run rpg:build` | 선택지 게임 정적 빌드 — **사용자용** (관리자 화면 없음) |
| `npm run rpg:build:admin` | 저작 도구가 포함된 빌드 |
| `npm run rpg:typecheck` | 선택지 게임 타입 검사 |
| `npm run bridge` | 로컬 브리지 |
| `npm run bridge:token` | 페어링 코드 출력 |

---

## 문서

| 문서 | 내용 |
|---|---|
| [docs/HANDOFF.md](docs/HANDOFF.md) | **직전 작업 인수인계** — 이어받는 사람이 가장 먼저 읽을 것 |
| [docs/STATUS.md](docs/STATUS.md) | **작업 현황** — 검증된 것, 남은 일, 함정 목록 |
| [docs/POLICY.md](docs/POLICY.md) | 정책 근거와 구조 결정 (왜 이렇게 만들었나) |
| [packages/bridge/README.md](packages/bridge/README.md) | 브리지 API·옵션·보안 |
| [apps/rpg/README.md](apps/rpg/README.md) | 선택지 게임 — 실행법·구조 |
| [apps/rpg/docs/STATUS.md](apps/rpg/docs/STATUS.md) | 선택지 게임 작업 현황·함정 |
| [apps/rpg/docs/DEVQUEST.md](apps/rpg/docs/DEVQUEST.md) | 샘플 시나리오 9화 전체 설계 |

**이어서 작업하는 사람은 [docs/HANDOFF.md](docs/HANDOFF.md) 부터 읽으세요** — 직전에 무엇을
했고 무엇이 검증됐는지, 다른 기기에서 시작할 때 먼저 해야 할 설정이 거기 있습니다.
그다음 [docs/STATUS.md](docs/STATUS.md) 의 함정 목록(4장)을 보세요. 모르면 같은 데서 시간을 버립니다.
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
