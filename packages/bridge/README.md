# @ownchat/bridge

내 PC의 Claude Code를 채팅 UI에 연결하는 로컬 브리지. 의존성 0 (Node 내장 모듈만).

```bash
npx @ownchat/bridge
```

터미널에 찍히는 **페어링 코드**를 채팅 UI 설정에 붙여넣으면 끝이다.
Claude Code 로그인은 채팅 UI의 **로그인 버튼**으로 할 수 있다 — 터미널에서 따로 할 필요 없다.

## 무엇을 하는가

1. `127.0.0.1` 에만 HTTP 서버를 띄운다.
2. 채팅 요청이 오면 이 PC에 설치된 **공식 Claude Code CLI**를 실행한다.
3. CLI의 스트리밍 출력(NDJSON)을 SSE로 바꿔 브라우저에 흘려준다.

Anthropic으로 나가는 요청은 전부 Claude Code가 만든다. 브리지는 로그인 정보를
저장하지도, 읽지도, 네트워크로 보내지도 않는다.

## 옵션

| 옵션 | 설명 |
|---|---|
| `--port <번호>` | 수신 포트 (기본 4319) |
| `--allow-origin <URL>` | 호출을 허용할 웹 UI 오리진. 여러 번 지정 가능 |
| `--model <별칭>` | 기본 모델 (`claude-opus-5` 등) |
| `--cli <경로>` | `claude` 실행 파일 경로 직접 지정 (PATH에 없을 때) |
| `--no-web` | 웹 검색·페이지 읽기 도구를 끈다 |
| `--keep-env-auth` | `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` 환경변수를 지우지 않는다 |
| `--print-token` | 페어링 코드만 출력하고 종료 |
| `--reset-token` | 페어링 코드 재발급 (기존 코드 즉시 무효) |

환경변수로도 지정 가능: `OWNCHAT_PORT`, `OWNCHAT_ALLOW_ORIGIN`(쉼표 구분),
`OWNCHAT_MODEL`, `OWNCHAT_HOME`, `CLAUDE_CLI_CMD`.

### `--keep-env-auth` 는 언제 필요한가

기본적으로 브리지는 자식 프로세스의 `ANTHROPIC_API_KEY`·`ANTHROPIC_AUTH_TOKEN` 을 지운다.
Claude Code의 인증 우선순위에서 **API 키가 구독 OAuth보다 위**라서, 환경에 키가 남아 있으면
"구독으로 쓰는 중"이라고 표시된 채 실제로는 종량제로 청구된다.

사내 LLM 게이트웨이처럼 이 값이 있어야 동작하는 환경이라면 `--keep-env-auth` 로 유지한다.

## API

`/health` 와 로그인 페이지를 뺀 모든 경로는 `Authorization: Bearer <페어링 코드>` 가 필요하다.

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/health` | 없음 | 브리지·CLI·로그인 상태. UI가 브리지 존재를 감지하는 용도 |
| GET | `/v1/status` | 토큰 | CLI 경로, 작업 폴더, 허용 오리진, 진행 중인 대화 수 |
| GET | `/v1/auth` | 토큰 | `claude auth status --json` 결과 (토큰 소모 없음) |
| POST | `/v1/login` | 토큰 | 공식 CLI 로그인 흐름 시작. 코드 입력 페이지 주소를 돌려준다 |
| POST | `/v1/chat` | 토큰 | 대화 한 턴. SSE로 응답 |
| GET | `/login` | 없음 | 브리지가 직접 서빙하는 코드 입력 페이지 |

### `POST /v1/chat`

```json
{ "message": "질문", "model": "claude-opus-5", "sessionId": null }
```

`sessionId` 를 주면 그 대화를 이어간다(`--resume`). 응답 SSE 이벤트:

| 이벤트 | 데이터 |
|---|---|
| `meta` | `{ sessionId, model }` — 이후 턴에 이 sessionId를 넘기면 대화가 이어진다 |
| `delta` | `{ text }` — 응답 조각 |
| `thinking` | `{ text }` — 사고 과정 요약 조각 |
| `notice` | `{ message }` — API 재시도 등 진행 상황 |
| `done` | `{ sessionId, costUsd, durationMs }` |
| `error` | `{ code, message, hint, detail }` |

`error.code` 는 `not_logged_in` / `rate_limited` / `cli_not_found` / `timeout` / `cli_error` 중 하나다.

## 보안

- `127.0.0.1` 에만 바인딩한다. 같은 네트워크의 다른 기기는 접근할 수 없다.
- 페어링 코드는 `~/.ownchat/bridge-token` 에 `0600` 으로 저장한다. 비교는 상수 시간으로 한다.
- 오리진 허용목록에 없는 웹페이지는 403으로 끊는다.
- `Host` 헤더가 로컬 호스트명이 아니면 421로 끊는다 (DNS 리바인딩 방어).
- 채팅용이라 **파일·셸·에이전트 도구를 전부 차단**한다. 이 차단은 구버전 CLI 호환
  폴백 경로에서도 유지된다.
- 로그인 코드 입력 화면은 브리지가 직접 서빙한다. 호스팅 UI 도메인은 그 값을 보지 않는다.

## 서버에 올리지 마세요

이 브리지를 서버에 올려 여러 사용자의 구독을 태우는 것은 Anthropic이 명시적으로 금지한
구조다. 자세한 근거는 [../../docs/POLICY.md](../../docs/POLICY.md).
