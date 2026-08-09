# ownchat

버튼형 인터랙티브 스토리, AI 자유 채팅, 관리자 저작 도구를 **하나의 Next.js 앱**으로 제공한다.

| | 관리자 설치형 | Vercel 사용자 웹 |
|---|---|---|
| 실행 | Electron | 브라우저 |
| AI | 내 PC의 Claude Code | 서버의 OpenAI API |
| 화면 | `/admin`, `/play`, `/chat`, `/tour` | `/play`, `/chat`, `/tour` |
| 데이터 | 로컬 편집 + JSON | PostgreSQL 발행본 + 중립 폴백 |

관리자는 설정 한 줄에서 노드·선택지·분기·엔딩 초안을 만들고 검수한 뒤 발행한다. 사용자는 작품에
따라 서울 2033식 고정 버튼으로 진행하거나, 심문 노드에서 등장인물에게 자유롭게 질문할 수 있다.
심문이 없는 작품은 플레이 중 AI 비용이 전혀 들지 않는다.

---

## 구조

```
apps/rpg ──┬── 관리자 프로필 → Electron IPC/로컬 브리지 → 내 PC의 Claude Code
          ├── hosted 프로필 → /api/openai/chat → OpenAI Responses API
          ├── /api/works, /api/tour → PostgreSQL
          └── DB 장애 → 브라우저 스냅샷/중립 번들 폴백
```

| 폴더 | 역할 |
|---|---|
| `packages/core` | Claude Code CLI를 구동하는 순수 로직 (HTTP도 UI도 모른다) |
| `apps/desktop` | `apps/rpg` 관리자 정적 빌드를 포장하는 Electron 셸 |
| `apps/rpg` | 통합 Next.js UI·스토리 엔진·채팅·서버 API·DB 접근 |
| `packages/bridge` | 브라우저 관리자 화면과 로컬 Claude를 잇는 HTTP 브리지 |

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

### 브라우저 관리자 개발

```bash
npm run bridge      # 터미널 1 — 페어링 코드가 찍힌다
npm run dev:web     # 터미널 2 — http://localhost:3200
```

설정에 페어링 코드를 붙여넣으면 구독으로 동작한다. 브리지 없이 쓰려면 API 키만 넣으면 된다.

### 공모전용 OpenAI 호스팅 데모

`apps/rpg/.env.local.example`을 참고해 `apps/rpg/.env.local`에 로컬 값을 넣는다. Vercel에서는
프로젝트 Settings → Environment Variables에 같은 키를 등록한다.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
DATABASE_URL=postgresql://...
# 선택: OWNCHAT_DEMO_TOKEN=관람자에게-공유할-별도-접근-코드
```

```bash
npm run dev:hosted       # 개발
npm run build:hosted     # 배포 빌드
npm run start:hosted     # 빌드 실행
```

Vercel 프로젝트 Root Directory는 `apps/rpg`다. `OPENAI_API_KEY`는 서버에서만 읽으며 브라우저
번들·localStorage로 내려가지 않는다. `OWNCHAT_DEMO_TOKEN`은 선택값이라 비워 두면 링크에서 바로
사용할 수 있다. 기본 모델은 `gpt-5.4-mini`이며 IP당 10분 30회, 출력 2,048토큰, 서버 프로세스 기준
일일 추정 200만 토큰으로 제한한다.

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
| `npm run build` | 통합 관리자 정적 빌드 (`apps/rpg/out` — Electron 렌더러) |
| `npm run dev:hosted` | OpenAI 서버 라우트를 포함한 공모전 데모 개발 서버 |
| `npm run build:hosted` | OpenAI 서버 라우트를 포함한 배포 빌드 |
| `npm run start:hosted` | 공모전 데모 빌드 실행 |
| `npm run rpg` | 통합 관리자 개발 서버 (`localhost:3200`) |
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
- 로컬 Claude의 페어링 코드·Anthropic API 키는 이 기기에만 저장된다. hosted 프로필의 채팅 내용은
  `apps/rpg` 서버를 거쳐 OpenAI API로 전달되며, OpenAI 키는 서버 환경변수에만 둔다.
- 배포용 서명(Windows 인증서, macOS 공증)은 아직 없다. 지금 빌드하면 OS 경고가 뜬다 —
  [STATUS.md 5장 A](docs/STATUS.md) 참조.
