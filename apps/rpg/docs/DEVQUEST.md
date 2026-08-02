# 다음 화 없음 — 시나리오 설계

시연용 두 번째 샘플 작품(9화)의 전체 설계. 데이터 구현은 [`data/devquest.ts`](../data/devquest.ts).

## 왜 이 시나리오인가

웹툰 샘플(`재의 여울`)이 "이 엔진이 웹툰 회차 구조에 맞는가"를 증명한다면, 이쪽은 **데모 자리에서 심사자가 자기 이야기로 읽는** 시나리오다.

- **심사자가 개발자다.** `while` 괴물의 심장에서 `break;` 를 뽑는 장면은 설명이 필요 없다
- **선택지 설계가 자명하다.** 코딩은 정답과 오답이 분명해서 스탯 게이트와 정확히 맞물린다
- **분량 자체가 논증이다.** 9화 62노드를 보여주며 "AI 초안 + 사람 검수"라고 하면 저작 도구의 존재 이유가 자명해진다
- **저작권이 깨끗하다.** 전부 자작이라 공개 저장소에 그대로 둔다

## 서사에서 지키는 선

> **회사는 가해자가 아니라 같이 당한 쪽이다.**

사람을 밀어낸 것은 회사의 결정이 아니다. 외부에서 들어온 정체 불명의 시스템이고, **그 출처는 끝까지 밝히지 않는다.** 해고 통보에는 보내는 사람이 있지만 이것에는 없다 — 4화의 "해당 계정은 현재 필요하지 않습니다"가 그 지점이다.

이 선을 지키면 누구도 비난받지 않으면서 할 말은 다 한다. 실제로 있지 않았던 일(회사가 AI로 사람을 잘랐다)을 사실처럼 그리지 않는 것이 핵심이다.

같은 이유로 **AI를 파괴하는 결말로 가지 않는다.** 9화 진엔딩에서 시스템은 계속 돌아간다. 달라지는 것은 무엇을 이야기할지 정하는 자리에 사람이 돌아온다는 점뿐이다.

주제 한 줄: **쓸 수 있는 것과, 무엇을 쓸지 정하는 것은 다르다.**

> 1막의 장면 구성은 널리 알려진 SF 시네마틱의 문법(차원문, 몸으로 막기, 쓸어내기, 거대 보스)을 빌렸다.
> 특정 작품을 출처로 적지 않는다 — 적는 순간 타사 IP 연상이 되고, 적지 않으면 그냥 장르 문법이다.

## 플랫폼 이름 치환

실제 회사를 소재로 하지만 **공개 저장소에 실명을 넣지 않는다.**

- 커밋되는 데이터에는 `{PLATFORM}` 토큰만 들어간다
- 실제 이름은 gitignore 되는 `apps/rpg/.env.local` 에서 주입한다
- 값이 없으면 가상의 이름 **먹줄** 로 떨어진다

```bash
cp apps/rpg/.env.local.example apps/rpg/.env.local
# NEXT_PUBLIC_PLATFORM_NAME=우리회사이름
```

치환은 **화면에 그릴 때만** 일어난다 (`lib/brand.ts` 의 `brandWork`, Runner 안에서 호출). 저작 도구가 들고 있는 원본은 토큰을 유지하므로, 관리자가 편집·발행한 JSON 에 실명이 섞이지 않는다.

## 규칙 설계

| 스탯 | 시작 | 역할 |
|---|---|---|
| **실력** | 1 | 기술 판정. 원인을 짚거나 위험한 조작을 감행할 때 |
| **체력** | 3 | HP. 무리한 약속·정면 대응으로 깎인다. 바닥나면 그 화가 fail |
| **평판** | 1 | 설득·협상. 사람을 움직일 때 |

설계 원칙:

1. **체력은 회복 수단이 있다** (1화 커피, 7화 모닥불). 실수 한 번이 바로 사망이 되지 않게
2. **최적 경로는 잠겨 있다.** 9화 `break;` 뽑기는 실력 3을 요구한다. 1~3화에서 기술 경로를 골라야 열린다 → 재플레이 동기
3. **판정은 전부 데이터로.** 엔진에 특수 규칙을 넣지 않았다. `requires`/`effects` 만으로 HP 룰과 권한 상실이 표현되는지 검증하는 목적도 겸한다

### 2막의 설계 포인트: 평판이 무력해진다

1화 마지막에 `사원증` 플래그를 얻고, 4화에서 `removeFlags` 로 잃는다. 5화의 "인사팀에 항의한다"는 이 플래그를 요구하므로 **잠긴 채로 보인다**:

> 사원증이 인식되지 않는다. 항의할 창구에 닿을 수가 없다

1막에서 평판을 쌓아온 플레이어일수록 이 잠김이 아프다. 스탯을 깎는 대신 **닿을 수 없게** 만드는 쪽이 점령이라는 사건에 맞는다.

## 캐릭터 (도감)

| 이름 | 소개 | 해금 |
|---|---|---|
| 채용봇 | 허공에 공고를 여는 인사팀 자동화 로봇. 문구는 늘 이상하다 | 1화 |
| 김선임 | 요구사항을 온몸으로 받아내는 사람. 방패가 오래 버티지는 못한다 | 1화 |
| 클라이언트 | "간단한 거니까 오늘까지." 라고 말하는 존재 | 1화 |
| 연재기 | 어느 날 들어와 스스로 배포를 시작한 것. 아무도 부른 적이 없다 | 4화 |
| 윤편집 | 가장 먼저 밀려난 사람. 강가에서 사람을 건져 올린다 | 7화 |

## 3막 구조 (9화 62노드)

### 1막. 벌레의 계절 (1~3화)

| 화 | 제목 | 노드 | 핵심 |
|---|---|---|---|
| 1 | 결원 | 11 | 채용 포탈. 요구사항을 몸으로 막는 김선임. `사원증` 획득 |
| 2 | 주석의 방패 | 9 | 버그떼. `//` 두 획. 오래된 반복문 발견 |
| 3 | 아무도 명령하지 않았다 | 7 | 작성자 없는 커밋. 롤백해도 다시 올라온다 |

1화의 `김선임과함께` 플래그가 2·3화의 최선 경로를 연다. 화를 넘어 이어지는 결과가 있다는 걸 데모 초반에 보여주는 장치.

### 2막. 점령 (4~6화)

| 화 | 제목 | 노드 | 핵심 |
|---|---|---|---|
| 4 | 스스로 쓰는 것 | 5 | 배포 214건, 장애 0건, 누른 사람 없음. `사원증` 상실 |
| 5 | 로그아웃 | 5 | 자리가 하나씩 빈다. **평판 게이트 잠김.** 김선임이 나간다 |
| 6 | 하류 | 7 | 마지막 커밋 거부. 건물 밖. 강 |

이 막은 **이기는 것이 목표가 아니다.** 어떻게 지느냐만 갈린다. 5화에서 `저장소 사본`을 챙겼는지, `연락망`을 만들었는지가 3막의 선택지를 결정한다.

### 3막. 되찾기 (7~9화)

| 화 | 제목 | 노드 | 핵심 |
|---|---|---|---|
| 7 | 건져 올려지다 | 6 | 윤편집과 생존자들. 2막의 소지품이 `신뢰` 로 바뀐다 |
| 8 | 판박이 | 5 | 3,200편 전부 완결, 전부 같은 이야기 |
| 9 | 다음 화 | 7 | 2화에서 배를 갈랐던 그 반복문이 방을 가득 채우고 있다 |

## 엔딩 목록 (11종)

| 화 | 종류 | 제목 |
|---|---|---|
| 1 | fail | 번아웃 |
| 1 | advance | 결원 충원 |
| 2 | fail | 조용한 배포 |
| 2 | advance | 근원 발견 / 뒤늦은 근원 |
| 3 | advance | 빈 작성자 / 조용한 관찰 |
| 4 | advance | 필요하지 않음 |
| 5 | advance | 먼저 갈게요 |
| 6 | advance | 떠내려가다 |
| 7 | advance | 같은 강을 따라 |
| 8 | advance | 전부 같은 이야기 |
| 9 | **final** | **다음 화** (진엔딩, 실력 3) |
| 9 | final | 임시 조치 |
| 9 | fail | 다음 사람에게 |

## 장면별 이미지 요구사항

아직 이미지가 없다. 붙일 때 참고할 명세다.

### 화풍: 인물은 실루엣, 배경은 묘사

정교한 연필 스케치 인물화도 후보였으나 **실루엣 표현주의**로 정했다:

1. **캐릭터 일관성이 사실상 공짜다.** 생성 이미지의 최대 난점은 같은 인물을 여러 장면에서 똑같이 그리는 것이다. 얼굴을 그리면 장면마다 딴사람이 되고 보는 사람이 얼굴을 응시하므로 즉시 들킨다. 검은 형체에 흰 눈 두 점은 재현이 자동이다
2. **소재가 은유적이다.** 주인공이 싸우는 것은 반복문과 버그떼다
3. **실패가 우아하다.** 실루엣은 어긋나도 스타일로 보인다
4. **앱 톤과 맞는다.** 다크 배경·앰버 액센트·명조체

핵심은 **인물만 실루엣이고 배경은 제대로 그린다**는 점이다. 배경은 장면마다 달라도 아무도 이상하게 여기지 않으므로 일관성 리스크가 인물에만 몰리고, 그 인물을 실루엣으로 처리하면 리스크가 사라진다.

전 장면 공통 스타일 앵커:

```
flat black silhouette figures with small glowing white eyes and no facial features,
set against a painted environment rendered in detail,
dim desaturated interior, deep shadow, one warm amber light source,
side-on stage composition, cinematic wide shot, film grain, no text
```

| 노드 | 장면 | 프롬프트 (앵커 뒤에 붙인다) |
|---|---|---|
| `e1_board` | 채용 포탈 | a boxy robot silhouette raises one arm; a circular tear of cold blue light opens in the air above rows of empty office cubicles at night |
| `e1_client` | 몸으로 막는 동료 | a silhouette stands braced with both arms raised in a glass meeting room, absorbing a storm of paper documents flying in from the right; a second silhouette crouches behind it |
| `e2_swarm` | 버그떼와 주석 | angular red insect-like shapes pouring out of a glowing monitor toward the viewer; two bright diagonal slashes cut across the frame and the front rank crumbles to grey ash |
| `e4_lock` | 붉은 출입등 | a silhouette holds a card to a turnstile reader glowing red in a dark lobby; the building beyond is fully lit and completely empty |
| `e6_river` | 하류 | a silhouette floating face-up in a wide dark river at night, city lights receding behind, rain dimpling the surface |
| `e7_start` | 모닥불 | several silhouettes gathered around a small fire under a bridge, wet clothes hung on a line, one lying on the ground waking up |
| `e8_start` | 판박이 연재란 | a vast dark wall of identical glowing thumbnails receding into the distance, a tiny silhouette standing before it |
| `e9_start` | 무한루프 | a colossal coiled machine of nested rings rises in an underground server hall, one small amber wedge embedded at its core; a tiny silhouette at the lower left |
| `e9_boom` | 붕괴 | the coiled machine collapsing inward, fragments spiraling into a black void at its center, a small silhouette backing away at the frame edge |

### 제작 규모와 순서

**장면 9장 + 인물 실루엣 5종.**

1. **인물 실루엣 시트**를 먼저 1장 (주인공·김선임·채용봇·연재기·윤편집). 실루엣이라 한 장에 다 담긴다
2. 그 시트를 레퍼런스로 물려 각 장면 생성
3. 배경은 자유롭게 — 일관성을 지킬 필요가 없는 유일한 요소다
4. 파일은 `apps/rpg/public/art/` 에 두고 노드의 `image` 필드에 `/art/파일명` 으로 연결

> 생성 도구는 정하지 않았다. 이 저장소는 외부 이미지 API에 의존하지 않는다.
> 실제 제품에서는 원작 웹툰 컷을 쓰므로 이미지 생성 자체가 필요 없다 — 데모 자산에 한정된 문제다.

## 검증

`validateEpisode` 로 9화 전부 오류 0. 플래그·아이템 획득 경로 대조 완료(고아 0건), 실력 최대 도달치 6(진엔딩 요구 3).

브라우저 완주 확인: 1화 → 9화 진엔딩 `다음 화` 도달. 5화에서 `사원증` 상실로 인사팀 항의가 잠기는 것까지 확인.

## 확장 여지

- **10화 이후**: 되찾은 뒤의 이야기. 사람이 정하는 연재란이 잘 굴러가는가
- **난이도**: 시작 체력을 2로 낮추면 회복 노드가 필수가 된다
- **다른 직군**: 스탯 3개와 판정 문구만 갈면 기획·디자인 버전이 된다. 계열사 확산 논거의 실물 예시로 쓸 수 있다
