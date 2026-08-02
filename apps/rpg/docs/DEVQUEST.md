# 레거시 왕국 — 시나리오 설계

시연용 두 번째 샘플 작품의 전체 설계. 데이터 구현은 [`data/devquest.ts`](../data/devquest.ts).

## 왜 이 시나리오인가

웹툰 샘플(`재의 여울`)이 "이 엔진이 웹툰 회차 구조에 맞는가"를 증명한다면, 이쪽은 **데모 자리에서 심사위원이 자기 이야기로 읽는** 시나리오다.

- **심사자가 개발자다.** `while` 괴물의 심장에서 `break;` 를 뽑는 장면은 설명이 필요 없다
- **선택지 설계가 자명하다.** 코딩은 정답과 오답이 분명해서 스탯 게이트와 정확히 맞물린다
- **저작권이 깨끗하다.** 전부 자작이라 공개 저장소에 그대로 둔다
- **자기참조적이다.** AI 저작 도구로 만든 게임의 주인공이 개발자다

> 장면 구성은 널리 알려진 SF 시네마틱의 문법(차원문, 몸으로 막기, 쓸어내기, 거대 보스)을 빌렸다.
> 특정 작품을 출처로 적지 않는다 — 적는 순간 타사 IP 연상이 되고, 적지 않으면 그냥 장르 문법이다.

## 규칙 설계

| 스탯 | 시작 | 역할 |
|---|---|---|
| **실력** | 1 | 기술 판정. 원인을 짚거나 위험한 조작을 감행할 때 |
| **체력** | 3 | HP. 무리한 약속·정면 대응으로 깎인다. 바닥나면 그 화가 fail |
| **평판** | 1 | 설득·협상. 사람을 움직일 때 |

설계 원칙 세 가지:

1. **체력은 회복 수단이 있다** (1화 커피). 실수 한 번이 바로 사망이 되지 않게
2. **최적 경로는 잠겨 있다.** 처음에는 실력 1이라 3화의 `break;` 뽑기(실력 3 필요)에 못 닿는다. 1·2화에서 정보를 캐야 열린다 → 재플레이 동기
3. **판정은 전부 데이터로.** 엔진에 특수 규칙을 넣지 않았다. `requires`/`effects` 만으로 HP 룰이 표현되는지 검증하는 목적도 겸한다

## 캐릭터 (도감)

| 이름 | 소개 | 해금 |
|---|---|---|
| 채용봇 | 허공에 공고를 여는 인사팀 자동화 로봇. 문구는 늘 이상하다 | 1화 `e1_board` |
| 김선임 | 요구사항을 온몸으로 받아내는 사람. 방패가 오래 버티지는 못한다 | 1화 `e1_client` |
| 클라이언트 | "간단한 거니까 오늘까지." 라고 말하는 존재 | 1화 `e1_client` |
| 무한루프 | 탈출 조건을 잃은 채 스스로 자라난 반복문 | 3화 `e3_start` |

## 1화. 결원 (노드 11)

목표: 팀을 만들고 살아남기.

```
e1_start ─┬─ 티켓 보드 ────────────────→ e1_board
          └─ 커피 (체력+1) → e1_coffee → e1_board

e1_board ─┬─ 공고 직접 수정 [평판 2] ──→ e1_hire_good ─┐
          ├─ 로봇이 쓴 대로 ───────────→ e1_hire_bad  ─┤
          └─ 혼자 하겠다 (체력-1) ─────→ e1_alone     ─┴→ e1_client

e1_client ┬─ 같이 막는다 [체력 2] (체력-1, 평판+1, 깃발:김선임과함께) → e1_together → e1_end
          ├─ 물러나 일정 계산 (실력+1) ────────────────────────────→ e1_calc     → e1_end
          └─ 전부 하겠다 (체력-3) ─────────────────────────────────→ e1_down  [FAIL]
```

핵심 설계: **1화에서 `김선임과함께` 깃발을 얻어야 2화의 최선 경로가 열린다.** 화를 넘어 이어지는 결과가 있다는 걸 데모에서 보여주는 장치.

## 2화. 주석의 방패 (노드 9)

목표: 붉은 것들을 처리하고 진짜 원인을 찾기.

```
e2_start ─┬─ 로그부터 (실력+1) → e2_log ────────→ e2_swarm
          └─ 일단 되돌린다 → e2_revert (체력-1) → e2_swarm

e2_swarm ─┬─ 전부 주석으로 (체력-1) → e2_all_comment ┬─ 그래도 배포 → e2_fail [FAIL]
          │                                          └─ 걷어낸다 → e2_root_late [ADVANCE]
          ├─ 한 놈만 남겨 원인 [실력 2] ─────────────→ e2_root [ADVANCE]
          └─ 동료를 부른다 [깃발:김선임과함께] → e2_call → e2_root [ADVANCE]
```

`e2_swarm` 이 이 화의 중심 장면이다. 세 갈래가 각각 다른 자원을 요구한다: 체력(무식하게), 실력(혼자 잘해서), 관계(1화의 선택).

## 3화. 무한루프 (노드 7)

목표: 반복을 끝내기.

```
e3_start ─┬─ 조건문을 살핀다 (실력+1) ──────→ e3_read
          └─ 먼저 공격 (체력-1) → e3_rush ──→ e3_read

e3_read ──┬─ break; 를 뽑는다 [실력 3] → e3_pull → e3_boom [FINAL: 탈출 조건]
          ├─ 조건을 false 로 ──────────────────────→ e3_false [FINAL: 임시 조치]
          └─ 물러난다 ────────────────────────────→ e3_retreat [FAIL: 다음 사람에게]
```

실력 3은 1·2화에서 기술 경로를 골라야 도달한다. 첫 플레이에서는 대개 잠겨 있어 "임시 조치" 엔딩을 보고, 두 번째 플레이에서 진엔딩에 닿는다.

## 엔딩 목록 (6종)

| 화 | 종류 | 제목 | 조건 |
|---|---|---|---|
| 1 | fail | 번아웃 | 요구를 전부 수락 (체력 -3) |
| 2 | fail | 조용한 배포 | 전부 주석 처리 후 배포 |
| 2 | advance | 근원 발견 | 실력 2 또는 김선임 동행 |
| 2 | advance | 뒤늦은 근원 | 주석으로 덮었다가 되돌림 |
| 3 | final | **탈출 조건** | 실력 3 — 진엔딩 |
| 3 | final | 임시 조치 | 조건을 false 로 |
| 3 | fail | 다음 사람에게 | 물러남 |

## 장면별 이미지 요구사항

아직 이미지가 없다. 붙일 때 참고할 명세다. 목표 화풍은 **정교한 연필 스케치 인물화**(호텔 더스크 계열) 또는 **고대비 실루엣 표현주의**(Beholder 계열)이며, 코드로 그린 벡터로는 도달할 수 없어 외부 생성 도구를 쓴다.

전 장면 공통 스타일 앵커 (프롬프트 앞에 붙여 일관성 유지):

```
monochrome pencil sketch, rotoscoped realism, heavy cross-hatching,
muted sepia-grey palette with a single warm amber accent,
cinematic wide shot, film grain, high contrast, no text
```

| 노드 | 장면 | 프롬프트 (스타일 앵커 뒤에 붙임) |
|---|---|---|
| `e1_board` | 채용봇이 허공에 공고를 연다 | a humanoid office robot raises one arm; a circular tear in the air opens above a dark empty office, cold light pouring out over cubicles |
| `e1_client` | 요구사항을 몸으로 받는 동료 | a lone figure stands braced in a meeting room, arms raised, absorbing a storm of paper documents flying at them; another figure crouches behind |
| `e2_swarm` | 버그떼와 주석 두 획 | angular insect-like shapes swarming out of a monitor toward the viewer; two bright diagonal slashes cut across the frame, the front rank crumbling to ash |
| `e3_start` | 무한루프 등장 | a colossal coiled mechanical serpent made of nested rings rises in an underground server hall, a single small glowing wedge embedded at its core |
| `e3_boom` | 붕괴 | the coiled machine collapsing inward on itself, fragments spiraling into a dark void at the center, a small figure backing away at the edge |

캐릭터 일관성이 관건이다. 장면마다 따로 생성하면 인물이 딴사람이 된다. 권장 순서:

1. 인물 **캐릭터 시트**를 먼저 1장 생성 (주인공·김선임·채용봇 정면/측면)
2. 그 이미지를 레퍼런스로 물려 각 장면을 image-to-image 로 생성
3. 보정은 사람이

## 확장 여지

- **4화 이후**: 배포, 장애 대응, 온콜, 인수인계. 같은 규칙으로 계속 얹을 수 있다
- **난이도**: 시작 체력을 2로 낮추면 커피 노드가 필수가 된다
- **다른 직군**: 스탯 3개와 판정 문구만 갈면 기획·디자인 버전이 된다. 계열사 확산 논거의 실물 예시로 쓸 수 있다
