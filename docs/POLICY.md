# 왜 이 구조인가 — 정책 근거

## 처음 아이디어와 그게 막히는 이유

> "사용자가 각자 Claude Pro/Max를 구독하고, 우리 서비스에 로그인하면 그 계정으로 채팅을 날린다.
> 그러면 서비스는 AI 토큰비를 낼 필요가 없다."

기술적으로는 가능하다. 그리고 **Anthropic이 명시적으로 금지한 구조다.**

[Claude Code — Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) 문서의
"Authentication and credential use" 항목:

- OAuth 인증은 **구독 구매자 본인이** Claude Code 및 Anthropic 자체 애플리케이션을
  일반적으로 사용하는 용도로만 의도된 것이다.
- 제품·서비스를 만드는 개발자는 (**Agent SDK 사용자 포함**) Claude Console 또는 지원 클라우드
  공급자를 통한 **API 키 인증을 써야 한다.**
- Anthropic은 서드파티 개발자가 Claude.ai 로그인을 제공하거나, 사용자를 대신해
  `"route requests through Free, Pro, or Max plan credentials on behalf of their users"`
  하는 것을 **허용하지 않는다.**
- 이 제한은 **사전 통보 없이 집행될 수 있다.**

같은 문서의 "Acceptable use" 항목은 Pro/Max의 광고된 사용량 한도가
**"ordinary, individual usage"** 를 전제한다고 명시한다.

### 표현 주의: "무제한"이라고 쓰지 않는다

Pro/Max에는 5시간 단위 사용량 한도가 있다. "무제한"은 **사실이 아니고**, 공개 문서에서 그렇게
쓰면 위 "ordinary, individual usage" 전제와 정면으로 부딪히는 — 즉 한도 우회를 권하는 —
프레이밍이 된다. 이 저장소는 다음 표현만 쓴다:

- ❌ "구독으로 무제한" / "제한 없이"
- ✅ "구독 요금 안에서" / "따로 청구되는 금액이 없다" / "종량제 과금 없음"

이 앱은 한도를 늘리거나 우회하지 않는다. 한도에 걸리면 `explainFailure` 가
`rate_limited` 로 분류해 사용자에게 그대로 알린다.

집행은 서비스 운영자보다 **사용자 계정 정지**로 먼저 온다. 서드파티 도구의 구독 인증이
실제로 차단됐다는 보고들이 있다 ([alternativeto](https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use),
[daveswift.com](https://daveswift.com/claude-trouble/)). 날짜와 차단 범위는 2차 출처라
확실하지 않지만, 1차 출처의 정책 문구 자체는 확인된 사실이다.

## 위험도 3단계

| 구조 | 정책 | 추론비 부담 |
|---|---|---|
| ❌ 서버가 사용자 구독 토큰을 받아 대신 호출 | **명시적 금지** | 없음 (대신 계정 정지) |
| ⚠️ 사용자 PC에서 공식 Claude Code를 구동하는 서드파티 UI | **회색** | 없음 |
| ✅ 사용자 본인 API 키(BYOK) | **공식 권장 경로** | 사용자 종량제 |

가운데 항목이 ownchat의 브리지다. 판단 근거:

- 요청을 만드는 클라이언트는 **공식 Claude Code 바이너리**다. 우리 코드가 Anthropic에
  HTTP를 치지 않는다.
- 실행 주체·머신·로그인이 전부 **사용자 본인**이고, 사용자가 직접 시작한 대화형 사용이다.
  정책이 말하는 "ordinary, individual usage"에 가까운 형태다.
- 우리 서버는 요청 경로에 없다. "on behalf of their users"에 해당하는 라우팅이 존재하지 않는다.

**다만 이건 우리 해석이고, Anthropic이 보증한 바는 아니다.** 특히 다음 순간 회색이 아니라
빨간색이 된다:

- 브리지를 서버에 올려 여러 사용자의 구독을 태우는 순간 → 금지된 1번 구조가 된다.
- 개인 사용 수준을 넘는 자동화된 대량 호출 → "ordinary, individual usage" 전제를 벗어난다.

## 결론: 양립 불가능한 두 가지

"호스팅 채팅 서비스"와 "사용자 구독 요금"은 동시에 가질 수 없다.

- **호스팅으로 간다** → BYOK API 키. 합법이지만 사용자가 종량제를 낸다.
- **구독으로 간다** → 로컬 앱. 추론비 0이지만 사용자가 설치해야 한다.

ownchat은 **둘 다** 만든다. 데스크톱 앱이 구독 경로, 호스팅 웹이 BYOK 경로다.
UI는 하나이고 전송 계층만 다르다. 어느 쪽이든 서비스 운영자의 추론 비용은 0이고,
서버는 자격증명을 보지 않는다.

### 데스크톱 앱이 웹보다 안전한 이유

호스팅 웹 + 브리지 구조에는 웹 도메인이라는 공격 표면이 있다. 페어링 코드가 우리 도메인의
localStorage에 있으니, 그 페이지에 XSS가 나면 코드가 탈취되어 사용자 구독이 무단 소모될 수 있다
(오리진 검사는 통과한다 — 우리가 허용목록이니까).

데스크톱 앱에는 그 표면이 없다. 렌더러는 서명된 로컬 파일만 로드하고, `app://` 스킴에
엄격한 CSP가 걸려 있고, 외부 링크는 OS 브라우저로 넘긴다. 그리고 페어링 코드라는 개념 자체가
없다 — 인증할 외부 호출자가 없기 때문이다.

### 폰에서는 구독을 쓸 수 없다

"구독으로 쓴다"는 것은 결국 사용자 기기에서 공식 Claude Code를 돌린다는 뜻이다.
그건 Node.js CLI라 iOS·Android에서 돌지 않는다. 폰에서 서버로 구독 토큰을 보내는 것은
위에서 본 금지된 구조다.

즉 **모바일 + 구독은 스택의 한계가 아니라 정책의 결과**다. 폰에서는 BYOK만 가능하다.

## 구조 결정 기록

### 1. 브리지는 `--bare` 를 쓰지 않는다

`claude --bare` 는 시작이 빠르고 환경 의존성이 없어 스크립트에 권장되는 모드다.
그런데 문서에 이렇게 적혀 있다: *"Bare mode skips OAuth and keychain reads."*

즉 **bare 모드는 구독으로 동작하지 않는다** — `ANTHROPIC_API_KEY`를 요구한다.
이 브리지의 존재 이유와 정반대라 쓸 수 없다.

대가로 사용자의 `~/.claude` 설정(전역 CLAUDE.md, 훅, 플러그인)이 함께 로드된다.
프로젝트 컨텍스트가 새는 것만 막았다:

- 빈 작업 폴더(`~/.ownchat/workspace`)에서 실행 → 프로젝트 CLAUDE.md 없음
- `--strict-mcp-config` (+ `--mcp-config` 미지정) → MCP 서버 0개

### 2. 시스템 프롬프트는 인자가 아니라 stdin으로 넣는다

Windows에서 npm 전역 설치본은 `claude.cmd`다. Node 20.12+는 `shell: true` 없이 `.cmd`
실행을 막고, `shell: true`는 인자를 자동으로 따옴표 처리하지 않는다. 긴 텍스트를
`--system-prompt` 로 넘기면 cmd.exe 파싱에서 깨진다.

그래서 브리지가 인자로 넘기는 값은 전부 공백·따옴표가 없는 형태로만 유지하고
(모델 별칭, UUID, 쉼표로 이은 도구 목록), 페르소나는 첫 턴 stdin 앞에 붙인다.
세션이 `--resume`으로 이어지므로 이후 턴에는 다시 보내지 않는다.

### 3. 채팅에는 파일·셸 도구를 주지 않는다

Claude Code는 코딩 에이전트다. 채팅 UI에 그대로 열어 주면 대화 내용에 섞여 들어온
지시로 로컬 파일이 수정될 수 있다. 브리지는 다음을 차단한다:

```
Bash BashOutput KillShell KillBash Read Write Edit MultiEdit
NotebookEdit Glob Grep Task Agent SlashCommand ExitPlanMode TodoWrite
```

웹 검색·페이지 읽기(`WebSearch`, `WebFetch`)는 채팅에 유용해서 기본 허용이고
`--no-web` 으로 끌 수 있다. 이 차단 목록은 구버전 CLI 호환을 위한 폴백 경로에서도
절대 떨어뜨리지 않는다 — 떨어지면 안전장치가 사라지기 때문이다.

### 4. 로그인 코드는 실행 환경에 따라 다른 곳에서 받는다

`claude auth login --claudeai` 는 TTY 없이도 브라우저를 열고, 브라우저가 보여주는
코드를 표준입력으로 받는다. 그 코드는 **계정 접근으로 교환되는 값**이다.

**호스팅 웹**에서 그 코드를 우리 도메인의 페이지로 받으면, XSS가 하나만 나도 사용자 계정이
넘어간다. 그래서 코드 입력 화면은 **브리지가 127.0.0.1에서 직접 서빙**한다.
우리 도메인의 자바스크립트는 그 값을 볼 방법이 없다.

**데스크톱 앱**에서는 앱 안에서 받는다. 렌더러가 서명된 로컬 파일만 로드하고 원격 콘텐츠를
불러오지 않으므로(엄격한 CSP + 외부 이동 차단), 그 코드가 나갈 수 있는 외부 오리진이 없다.
그리고 여기서 앱 코드를 침해할 수 있는 공격자는 이미 그 기기에서 코드 실행이 가능한 상태라,
"우리 코드를 거쳐 간다"는 위험의 실질이 웹과 다르다.

> **더 보수적인 대안**: 터미널 창을 띄워 공식 CLI가 자기 프롬프트로 코드를 받게 하는 방법이
> 있다(같은 저자의 feedback-radar 프로젝트가 그렇게 한다). 자격증명이 우리 코드를 아예
> 지나가지 않는다는 점에서 더 안전하다. 대신 터미널이 없는 환경(원격·컨테이너)에서 실패하고,
> 소비자용 앱에서 터미널 창이 튀어나오는 것은 나쁜 경험이다. 이 트레이드오프는 열려 있다 —
> [STATUS.md 5장 C](STATUS.md) 참조.

어느 경로든 발급된 토큰은 공식 CLI가 자기 저장소(`~/.claude/.credentials.json` 또는 OS
키체인)에 넣는다. ownchat은 저장하지도 읽지도 않는다.

### 5. 로그인 여부는 대화를 날려보지 않고 확인한다

`claude auth status --json` 은 토큰을 소모하지 않고 아래를 돌려준다:

```json
{ "loggedIn": false, "authMethod": "none", "apiProvider": "firstParty" }
```

이걸 쓰면 "로그인 됐나?"를 확인하려고 실제 대화를 한 번 태울 필요가 없다.
브리지는 이 값을 5초 캐시해서 `/health` 에 실어 보낸다.

### 6. 브리지는 토큰 없는 요청을 받지 않는다

로컬 HTTP 서버는 사용자가 방문하는 아무 웹페이지나 요청을 보낼 수 있는 대상이다.
방어선은 4겹이다:

1. `127.0.0.1` 에만 바인딩 — 같은 네트워크의 다른 기기는 접근 불가
2. `Authorization: Bearer <페어링 코드>` 필수 (`/health`, 로그인 페이지 제외)
3. 오리진 허용목록 — 목록에 없으면 403
4. `Host` 헤더 검사 — DNS 리바인딩으로 CORS를 우회하는 경로를 막는다

코드는 `~/.ownchat/bridge-token` 에 0600으로 저장하고, `--reset-token` 으로 즉시 무효화할 수 있다.

### 7. API 키는 브라우저에서 직접 쓴다

BYOK 모드는 `@anthropic-ai/sdk` 를 브라우저에서 `dangerouslyAllowBrowser: true` 로
쓴다(내부적으로 `anthropic-dangerous-direct-browser-access` 헤더를 붙인다).
"dangerous"는 **운영자의 키를 프런트에 심는 경우**를 경고하는 이름이고,
사용자가 자기 키를 넣는 BYOK는 Anthropic이 이 옵션의 의도된 용례로 문서화한 형태다.

우리 서버를 경유하는 프록시를 두지 않은 이유: 프록시를 두면 사용자 키가 우리 서버를
지나간다. 그 순간 "우리는 자격증명을 보지 않는다"가 거짓이 된다.
