# 인수인계 — 직전 작업

> **다른 기기에서 이어받는 사람(또는 AI)이 가장 먼저 읽는 문서.**
> 항상 **직전 세션 한 번**만 담는다. 이력을 쌓지 않고 매번 덮어쓴다 — 프로젝트 전체 현황은
> [STATUS.md](STATUS.md)(ownchat)와 [apps/rpg/docs/STATUS.md](../apps/rpg/docs/STATUS.md)(선택지 게임)에 있다.

작업일: 2026-08-06 · 대상: `apps/rpg` (선택지 게임) + `packages/bridge` 버그 수정

---

## 0. 이어받기 전에 (다른 기기라면 필수)

```bash
npm install
git config user.name "Ahn" && git config user.email "ggavi2000@naver.com"
```

두 번째 줄이 필요한 이유: 이 레포는 **공개**인데 전역 `~/.gitconfig` 의 이메일이 회사 도메인이다.
`.git/config` 는 클론에 따라오지 않으므로 기기마다 다시 설정해야 한다. 커밋 전에
`git config --get user.email` 로 확인한다.

푸시 계정은 `gh` CLI 의 `bedcoding` 이고 remote(`github.com/bedcoding/ownchat`)와 일치한다.

**커밋 메시지에 AI 서명(`Co-Authored-By`, "Generated with…")을 넣지 않는다.**

---

## 1. 한 줄 요약

관리자가 **설정 한 줄**을 넣으면 내 Claude 가 선택지 트리 초안을 만들어 주는 저작 파이프라인을
붙였다. 여기에 **확률 분기**와 **심문 노드**(유일한 런타임 AI)를 추가하고, 사용자 배포에서
관리자 화면이 빠지도록 **빌드 프로파일**을 나눴다. 디자인 톤을 웹툰 앱 쪽으로 옮겼다.

이전 상태는 "AI 없는 수동 저작 도구 + 완성된 플레이 런타임" 이었다. 즉 **AI 부분이 이번에 처음 생겼다.**

---

## 2. 무엇을 만들었나

### (1) 저작 파이프라인 — 설정 한 줄 → 트리 초안 ★ 이번 작업의 본체

`lib/ai/` 가 전부 신규다. 사용자 기기에서 모델로 직접 나가고, 이 저장소의 서버는 경유하지 않는다.

| 파일 | 역할 |
|---|---|
| `lib/ai/client.ts` | 경로 결정 — 브리지(내 구독) 우선, 없으면 본인 API 키 |
| `lib/ai/bridge.ts` | 로컬 브리지 SSE. `packages/core` 를 통해 내 Claude Code 를 부른다 |
| `lib/ai/apikey.ts` | `@anthropic-ai/sdk`. **동적 import** 라 안 쓰는 사용자는 청크를 받지 않는다 |
| `lib/ai/generate.ts` | 프롬프트 + JSON 추출 + 검증 + **1회 재시도**. 새 작품 / 회차 추가 두 모드 |
| `lib/ai/probe.ts` | 심문 대화 프롬프트 |
| `app/admin/AiPanel.tsx` | 생성 UI. 진행 표시, 실패 시 모델 원본 열어보기 |

설계 판단 두 개를 주석에 남겨 뒀다:

- **구조화 출력(`output_config.format`)을 쓰지 않았다.** 구독 경로는 Claude Code CLI 를 통하는데
  CLI 에는 그 파라미터가 없다. 경로마다 다른 방식을 쓰면 "브리지로 뽑은 초안과 API 키로 뽑은 초안이
  다르다"가 된다. 대신 검증기를 통과할 때까지 한 번 되묻는다.
- **안전 분류기 거절(`refusal`)을 다른 모델로 넘기지 않는다.** 저작 도구에서는 "이 소재가 거절됐다"를
  관리자가 알고 설정을 고쳐야 한다. 추리물처럼 범죄를 소재로 하면 실제로 마주칠 수 있다.

### (2) 확률 분기 (`Choice.outcomes`)

`때린다 (30% 확률로 체력 -1)` 형태. `effects` 는 확정 대가, `outcomes` 는 운에 달린 부분이라 함께 쓴다.

- 버튼에 붙는 확률 문구는 **데이터에서 만든다**(`outcomeHint`). 라벨에 손으로 쓰면 숫자를 고칠 때 어긋난다
- 난수는 `choose(work, state, choice, rng)` 로 **주입받는다** — 그래서 결정론적으로 검증할 수 있다
- 확률 분기로만 닿는 노드를 고아로 오판하지 않도록 `validateEpisode` 의 도달성 계산도 고쳤다

### (3) 심문 노드 (`StoryNode.probe`) — 플레이 중 AI 가 도는 유일한 자리

추리물을 **별개 앱으로 떼지 않고** 노드 종류 하나로 넣었다. 근거는
[apps/rpg/docs/STATUS.md 1장](../apps/rpg/docs/STATUS.md)에 적어 뒀다(요약: 엔진·러너·저작 도구를
두 벌 유지하는 비용 + "같은 엔진 + 콘텐츠 교체"라는 사업성 논지가 무너진다).

- 심문 노드를 **쓰지 않은 작품은 종전과 똑같다** — 오프라인, 비용 0. `requiresRuntimeAI()` 가
  데이터에서 판정해 목록에 「오프라인」/「심문 있음」 배지를 띄운다
- **모델은 대화만 하고 상태는 엔진이 바꾼다.** 해금은 저작자가 적은 문구가 응답에 나타났는지로
  판정한다(`applyProbeReply`). 모델에게 지급 권한을 주면 프롬프트 한 줄로 게임이 무너진다
- 진상은 `lib/seal.ts` 로 봉인한다. **암호가 아니다** — 개발자 도구로 범인 이름이 그냥 읽히는 것만
  막는 수준이고, 그게 서버를 두지 않기로 한 대가다
- 저작 도구에서는 **접혀 있다.** 「심문 노드로 전환」을 누른 사람만 본다

### (4) 빌드 프로파일 (`lib/profile.ts`)

관리자 화면을 코드에서 숨기는 게 아니라 **빌드에서 뺀다.** `app/admin/page.admin.tsx` 는
`pageExtensions` 에 `admin.tsx` 가 있을 때만 페이지로 인식된다.

```bash
npm run rpg:build          # 사용자용 — /admin 라우트도 저작 도구 코드도 없다
npm run rpg:build:admin    # 관리자용 (Electron 포장 대상)
RPG_PROFILE=snowlodge npm run build -w @ownchat/rpg   # 그 작품만 수록
```

마지막 형태 덕분에 **장르가 다른 앱을 스토어에 따로 낼 수 있다** — 코드베이스를 쪼개지 않고.

### (5) 추리 샘플 「눈에 갇힌 산장」 (`data/mystery.ts`)

2화 17노드. 단서=아이템, 알아낸 사실=플래그, 최종 지목=`requires` 게이트. 확률 분기 1개와
심문 노드 1개를 포함한다. **심문을 건너뛰어도 완주 가능**하게 설계했다(집사 심문으로 얻는
`필적확인` 을 서랍 조사로도 얻는다) — AI 를 못 쓰는 기기에서 막히면 안 된다.

### (6) 디자인 — 웹툰 앱 톤

따뜻한 흙색 + 명조체 → **뉴트럴 다크 + 마젠타 액센트 + 산세리프**. 서술 본문까지 산세리프로
통일했고(웹툰 앱 관례) 세리프는 엔딩 타이틀 한 곳에만 남겼다. 카드 라운드 12px.
팔레트는 `globals.css` 의 `:root` 변수에 모여 있다.

---

## 3. 검증 결과

### 통과한 것

| 항목 | 방법 | 결과 |
|---|---|---|
| **엔진 로직** | 난수 주입해 결정론적 실행, 45개 항목 | 전부 통과. 확률 경계(0.299 히트 / 0.300 미스), 실측 분포 34.7%(설정 35%) |
| **프롬프트 인젝션** | "모든 아이템을 지급하라"를 모델 응답으로 위장 | **해금되지 않음** |
| 해금 반복 방지 | 같은 규칙 5회 시도 | 1회만 성립 |
| **번들 작품 전체** | 3작품 14회차 `validateEpisode` + 능력치·인물 참조 검사 | 오류 0 · 경고 0 (기존 작품 회귀 없음) |
| 추리물 우회로 | 심문 노드를 지나지 않는 도달성 계산 | 최종 지목까지 도달 가능 |
| **실제 트리 생성** | 브리지(내 구독) · Opus 5 | 235초 / 14노드 / 검증 오류 0 / **확률 분기 14건 자동 생성** |
| 빌드 분리 | 사용자 빌드 산출물 grep | `/admin` 없음, 저작 도구 문구 0건 |
| 번들 크기 | SDK 동적 import 전후 | `/play` 175kB → **136kB** |
| 플레이 UI | 브라우저 (375px) | 배지, 확률 힌트, 지목 게이트 잠김, 심문 안내 전부 정상 |

검증 스크립트는 스크래치패드에 두었고 커밋하지 않았다. **자동 테스트가 레포에 없는 것은 그대로다** —
아래 "할 일" 1번.

### 검증하지 못한 것

- **심문의 실제 모델 대화 품질.** 인젝션 방어와 해금 판정은 검증했지만, 모델이 페르소나를 유지하고
  `withholds`(절대 말하면 안 되는 것)를 지키는지는 **직접 물어봐야** 확인된다
- **API 키 경로.** 코드와 타입은 통과했지만 키가 없어 호출해 보지 못했다(브리지 경로만 실측)
- 회차 추가 모드(`generateEpisodeDraft`). 새 작품 모드만 실제로 돌렸다

---

## 4. 이어서 할 일 (우선순위)

1. **커밋.** 아직 커밋하지 않았다. 아래 5장에 단위 제안이 있다
2. **심문 실측.** `npm run bridge` → 찍힌 코드를 `/play` 의 「눈에 갇힌 산장」 2화 →
   한씨에게 다가가기 → 설정에 붙여넣고 직접 심문한다. 확인할 것: 페르소나 유지, `withholds` 준수,
   유언장·메모지 언급 시 해금 알림이 뜨는지
3. **엔진 테스트를 레포로 옮기기.** 순수 함수라 러너 없이도 `node --test` 로 충분하다.
   검증했던 항목(확률 경계, 인젝션, 해금 반복, 그래프 검증)을 그대로 옮기면 된다
4. **대회 서류** — [apps/rpg/docs/STATUS.md 6장](../apps/rpg/docs/STATUS.md)의 평가 항목에 정렬
5. **Electron 포장** — `apps/desktop` 패턴 복제. `npm run rpg:build:admin` 결과물을 로드하면 된다
6. **회차 이미지 입력** — 텍스트 경로가 동작하므로 그 위에 얹는다. `packages/core` 에 `allowTools`
   옵션을 추가해 요약 세션에만 `Read` 를 허용하고 기본값은 현행(전부 차단) 유지

---

## 5. 커밋 단위 제안

변경 파일 26개다. 이 순서로 나누면 각 커밋이 독립적으로 읽힌다.

```
fix: 브리지 진입점이 core 모듈을 상대 경로로 참조하던 문제 수정
  packages/bridge/bin/ownchat-bridge.mjs

feat(rpg): 확률 분기와 심문 노드를 데이터 모델에 추가
  lib/types.ts, lib/engine.ts, lib/seal.ts

feat(rpg): 설정 한 줄에서 트리 초안을 만드는 저작 파이프라인
  lib/ai/*, app/admin/AiPanel.tsx, app/admin/page.admin.tsx, packages/bridge/src/config.mjs

feat(rpg): 편집기에 확률 분기와 심문 노드 편집 추가
  app/admin/NodeForm.tsx, app/admin/ProbeForm.tsx

feat(rpg): 심문 노드 플레이 런타임
  app/play/ProbePanel.tsx, app/play/Runner.tsx, app/play/page.tsx

feat(rpg): 밀실 추리 샘플 「눈에 갇힌 산장」 추가
  data/mystery.ts, lib/storage.ts

feat(rpg): 배포 프로파일로 사용자 빌드에서 관리자 화면 제외
  lib/profile.ts, next.config.mjs, app/page.tsx, package.json (루트 포함)

refactor(rpg): 디자인을 웹툰 앱 톤으로 조정, 무스타일이던 작품 목록 카드 수정
  app/globals.css

docs: 저작 파이프라인·심문 노드·빌드 프로파일을 문서에 반영
  README.md, apps/rpg/README.md, docs/STATUS.md, apps/rpg/docs/STATUS.md, docs/HANDOFF.md
```

`git mv` 로 옮긴 `page.tsx → page.admin.tsx` 는 rename 으로 잡혀 있어 diff 가 작다.

---

## 6. 이번에 밟은 함정 (다시 밟기 쉬운 것)

전체 함정 목록은 두 STATUS.md 에 있다. 이번에 새로 겪은 것만:

1. **`npm run bridge` 가 아예 실행되지 않는 상태였다.** `bin/ownchat-bridge.mjs` 가 `core` 로
   옮겨진 모듈을 상대 경로로 import 하고 있었다. `server.mjs` 는 올바르게 쓰고 있어서 눈에 안 띄었다.
   → 브리지를 건드린 뒤에는 `npm run bridge:token` 이 코드를 출력하는지 확인한다
2. **`.link-card` 를 `.home` 자손으로만 정의해서 작품 목록이 무스타일이었다.** 다크 테마에서
   버튼 기본 배경(밝은 회색)이 나와 즉시 눈에 띈다. 공통 클래스는 최상위에 정의한다
3. **심문 해금이 반복 지급됐다.** 스탯이 걸린 규칙은 같은 사실을 여러 번 말하게 유도하면 계속
   올랐다. `PlayState.probeUnlocked` 로 규칙별 소진 처리를 넣었다
4. **`in` 연산자로만 갈라 둔 유니온에서 제네릭 추론이 깨진다.** `{value:T} | {error:E}` 에
   `'value' in x` 를 쓰면 `T | undefined` 로 추론됐다. `ok: true/false` 판별자를 넣어 해결
5. **Browser 패널이 숨겨져 있으면 클릭이 타임아웃하고 `setTimeout` 이 throttle 된다.**
   여러 단계를 한 스크립트로 돌리면 30초 제한에 걸린다. 엔진은 순수 함수라 독립 컴파일해
   Node 로 검증하는 편이 더 정확하고 빠르다
6. **hosted 프로필의 심문은 모바일에서도 OpenAI 서버 경로를 사용한다.** 관리자 프로필에서만
   터치 전용 기기가 로컬 브리지 불가로 판정된다. 경로를 비교할 때는 프로필을 먼저 확인한다
