import type { Work } from '@/lib/types';

/**
 * 시연용 두 번째 샘플: 개발자 판타지.
 *
 * 웹툰 샘플(`sample.ts`)이 "이 엔진이 웹툰에 맞는가"를 보여준다면, 이쪽은 데모 자리에서
 * 심사위원이 **자기 이야기로 읽는** 시나리오다. 코딩은 정답과 오답이 분명해서
 * 스탯 게이트와 잘 맞고, 틀리면 체력이 깎여 게임오버로 이어지는 규칙이 자연스럽다.
 *
 * 전부 자작이다. 실제 작품·타사 IP를 쓰지 않으므로 공개 저장소에 그대로 둘 수 있다.
 *
 * 체력이 0이 되면 그 화가 fail 로 끝난다. 판정은 선택지의 requires 로만 하고
 * 엔진은 손대지 않는다 — 데이터만으로 규칙을 표현할 수 있는지 검증하는 목적도 겸한다.
 */
export const DEV_WORK: Work = {
  id: 'work-devquest',
  title: '레거시 왕국',
  rating: 'all',
  stats: { 실력: 1, 체력: 3, 평판: 1 },
  characters: [
    { id: 'bot', name: '채용봇', intro: '허공에 공고를 여는 인사팀 자동화 로봇. 문구는 늘 이상하다.' },
    { id: 'kim', name: '김선임', intro: '요구사항을 온몸으로 받아내는 사람. 방패가 오래 버티지는 못한다.' },
    { id: 'client', name: '클라이언트', intro: '"간단한 거니까 오늘까지." 라고 말하는 존재.' },
    { id: 'whiles', name: '무한루프', intro: '탈출 조건을 잃은 채 스스로 자라난 반복문.' },
  ],
  episodes: [
    // ── 1화 ────────────────────────────────────────────────────
    {
      id: 'dev-ep1',
      index: 1,
      title: '1화. 결원',
      entry: 'e1_start',
      nodes: [
        {
          id: 'e1_start',
          text: '스프린트 3일차. 남은 티켓 47개, 남은 사람 한 명.\n모니터 불빛만 살아 있는 사무실에서 너는 아직 로그아웃하지 못했다.',
          choices: [
            { label: '티켓 보드를 연다', next: 'e1_board' },
            {
              label: '일단 커피를 내린다',
              next: 'e1_coffee',
              effects: { stats: { 체력: 1 } },
            },
          ],
        },
        {
          id: 'e1_coffee',
          text: '뜨거운 것이 목을 타고 내려간다. 조금은 버틸 만해졌다.\n체력을 회복했다.',
          choices: [{ label: '티켓 보드를 연다', next: 'e1_board' }],
        },
        {
          id: 'e1_board',
          speaker: '채용봇',
          text: '"인력 부족 감지. 충원 절차를 개시합니다."\n로봇이 허공을 향해 손을 들자 빈 공간이 갈라지며 채용공고가 열린다. 푸른 빛이 사무실 천장까지 치솟는다.',
          reveals: ['bot'],
          choices: [
            {
              label: '공고 문구를 직접 고친다',
              next: 'e1_hire_good',
              requires: { stats: { 평판: 2 } },
              lockedHint: '인사팀을 움직일 말이 아직 없다 (평판 2 필요)',
            },
            { label: '로봇이 쓴 대로 올린다', next: 'e1_hire_bad' },
            {
              label: '충원 없이 혼자 하겠다고 한다',
              next: 'e1_alone',
              effects: { stats: { 체력: -1 } },
            },
          ],
        },
        {
          id: 'e1_hire_good',
          text: '"레거시를 무서워하지 않는 사람을 찾습니다."\n네가 고친 한 줄에 사람이 모였다. 쓸 만한 동료가 합류한다.',
          choices: [{ label: '회의실로 향한다', next: 'e1_client' }],
          reveals: [],
        },
        {
          id: 'e1_hire_bad',
          text: '"열정 있는 인재 구함. 다양한 업무 경험 가능."\n지원자는 왔다. 첫날부터 프로덕션에 배포를 시도한다.',
          choices: [{ label: '회의실로 향한다', next: 'e1_client' }],
        },
        {
          id: 'e1_alone',
          text: '혼자 하겠다고 말한 순간, 티켓 47개가 전부 네 이름으로 바뀐다.\n체력이 깎였다.',
          choices: [{ label: '회의실로 향한다', next: 'e1_client' }],
        },
        {
          id: 'e1_client',
          speaker: '클라이언트',
          text: '"간단한 거예요. 로그인에 얼굴 인식만 붙여주시면 됩니다. 오늘까지."\n요구사항이 화살처럼 쏟아진다. 김선임이 말없이 앞으로 걸어 나가 그것을 전부 몸으로 받는다.',
          reveals: ['kim', 'client'],
          choices: [
            {
              label: '옆에 서서 같이 막는다',
              next: 'e1_together',
              requires: { stats: { 체력: 2 } },
              lockedHint: '지금 몸으로는 한 발도 못 버틴다 (체력 2 필요)',
              effects: { stats: { 체력: -1, 평판: 1 }, flags: ['김선임과함께'] },
            },
            {
              label: '뒤로 물러나 일정부터 계산한다',
              next: 'e1_calc',
              effects: { stats: { 실력: 1 } },
            },
            {
              label: '전부 하겠다고 대답한다',
              next: 'e1_down',
              effects: { stats: { 체력: -3 } },
            },
          ],
        },
        {
          id: 'e1_together',
          text: '둘이 버티자 화살이 갈라진다. 김선임이 처음으로 너를 본다.\n"다음엔 먼저 말해요. 혼자 맞지 말고."',
          choices: [{ label: '회의를 끝낸다', next: 'e1_end' }],
        },
        {
          id: 'e1_calc',
          text: '너는 화이트보드에 숫자를 적는다. 3주. 아무도 반박하지 못한다.\n김선임이 쓰러지기 직전에 회의가 끝났다.',
          choices: [{ label: '회의를 끝낸다', next: 'e1_end' }],
        },
        {
          id: 'e1_down',
          text: '"할 수 있습니다." 라고 말한 순간 시야가 흐려진다.\n다음 기억은 없다.',
          choices: [],
          ending: {
            kind: 'fail',
            title: '번아웃',
            text: '무리한 약속은 체력으로 결제된다. 잔액이 부족했다.',
          },
        },
        {
          id: 'e1_end',
          text: '자리로 돌아오니 새 동료의 계정이 만들어져 있다.\n적어도 혼자는 아니다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '결원 충원',
            text: '팀이 생겼다. 이제 코드를 볼 차례다.',
          },
        },
      ],
    },

    // ── 2화 ────────────────────────────────────────────────────
    {
      id: 'dev-ep2',
      index: 2,
      title: '2화. 주석의 방패',
      recap: '팀을 꾸린 너는 처음으로 저장소를 열었다.',
      entry: 'e2_start',
      nodes: [
        {
          id: 'e2_start',
          text: '저장소를 연 순간 콘솔이 붉게 물든다.\n형체를 알 수 없는 것들이 스택 트레이스를 타고 기어 올라온다. 이름 없는 예외들이다.',
          choices: [
            { label: '로그부터 읽는다', next: 'e2_log', effects: { stats: { 실력: 1 } } },
            { label: '일단 되돌린다', next: 'e2_revert' },
          ],
        },
        {
          id: 'e2_log',
          text: '수천 줄 아래에서 같은 문장이 반복된다.\n`Cannot read property of undefined`. 전부 한 곳을 가리키고 있다.',
          choices: [{ label: '그 파일을 연다', next: 'e2_swarm' }],
        },
        {
          id: 'e2_revert',
          text: '되돌렸지만 붉은 것들은 사라지지 않는다. 원인은 훨씬 전부터 있었다.\n시간만 잃었다.',
          choices: [{ label: '결국 파일을 연다', next: 'e2_swarm', effects: { stats: { 체력: -1 } } }],
        },
        {
          id: 'e2_swarm',
          text: '파일이 열리자 그것들이 한꺼번에 달려든다.\n너는 반사적으로 손을 뻗어 허공에 두 획을 긋는다.\n\n"주석처리!"\n\n`//` 가 빛을 내며 앞줄을 쓸어버린다. 달려들던 것들이 조용히 회색으로 죽는다.',
          choices: [
            {
              label: '남은 것까지 전부 주석으로 덮는다',
              next: 'e2_all_comment',
              effects: { stats: { 체력: -1 }, flags: ['전부주석'] },
            },
            {
              label: '한 놈만 남겨 원인을 캔다',
              next: 'e2_root',
              requires: { stats: { 실력: 2 } },
              lockedHint: '어느 놈이 진짜인지 아직 구분이 안 된다 (실력 2 필요)',
            },
            { label: '동료를 부른다', next: 'e2_call', requires: { flags: ['김선임과함께'] }, lockedHint: '아직 그렇게 부를 사이가 아니다' },
          ],
        },
        {
          id: 'e2_all_comment',
          text: '화면이 온통 회색이 된다. 조용해졌다.\n조용해졌다는 것 말고는 아무것도 해결되지 않았다.',
          choices: [{ label: '그래도 배포한다', next: 'e2_fail' }, { label: '주석을 다시 걷어낸다', next: 'e2_root_late' }],
        },
        {
          id: 'e2_call',
          speaker: '김선임',
          text: '"그거 주석으로 덮으면 다음 주에 두 배로 옵니다."\n김선임이 옆자리에 앉는다. 둘이 함께 마지막 한 놈을 몰아넣는다.',
          choices: [{ label: '함께 원인을 캔다', next: 'e2_root' }],
        },
        {
          id: 'e2_root',
          text: '마지막 한 놈의 배를 갈라보니 안에서 오래된 반복문이 나온다.\n탈출 조건이 없다. 누군가 아주 예전에 `break;` 를 지웠다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '근원 발견',
            text: '이건 버그가 아니었다. 아직 끝나지 않은 반복이었다.',
          },
        },
        {
          id: 'e2_root_late',
          text: '걷어내자 다시 붉어진다. 하지만 이번엔 어디를 봐야 하는지 안다.\n오래된 반복문 하나가 심장처럼 뛰고 있다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '뒤늦은 근원',
            text: '돌아가는 길이었지만 도착은 했다.',
          },
        },
        {
          id: 'e2_fail',
          text: '회색 코드가 그대로 프로덕션에 올라간다.\n30분 뒤, 전화가 울리기 시작한다. 멈추지 않는다.',
          choices: [],
          ending: {
            kind: 'fail',
            title: '조용한 배포',
            text: '숨긴 것은 사라지지 않는다. 다음 주에 두 배로 돌아온다.',
          },
        },
      ],
    },

    // ── 3화 ────────────────────────────────────────────────────
    {
      id: 'dev-ep3',
      index: 3,
      title: '3화. 무한루프',
      recap: '오래된 반복문 하나가 모든 것의 근원이었다.',
      entry: 'e3_start',
      nodes: [
        {
          id: 'e3_start',
          text: '지하 깊은 모듈에서 그것이 일어선다.\n수백만 번 돌면서 스스로를 불려온 반복문. 벽을 밀어내며 너를 향해 몸을 기울인다.',
          reveals: ['whiles'],
          choices: [
            { label: '조건문을 살핀다', next: 'e3_read', effects: { stats: { 실력: 1 } } },
            { label: '먼저 공격한다', next: 'e3_rush', effects: { stats: { 체력: -1 } } },
          ],
        },
        {
          id: 'e3_read',
          text: '`while (true)` 안쪽에 단 하나, 오래된 `break;` 가 박혀 있다.\n그것이 이 괴물을 겨우 사람의 편에 묶어두고 있었다.',
          choices: [
            {
              label: '`break;` 를 손으로 뽑아버린다',
              next: 'e3_pull',
              requires: { stats: { 실력: 3 } },
              lockedHint: '뽑으면 어떻게 되는지 아직 확신이 없다 (실력 3 필요)',
            },
            { label: '조건을 false 로 바꾼다', next: 'e3_false' },
            { label: '뒤로 물러난다', next: 'e3_retreat' },
          ],
        },
        {
          id: 'e3_rush',
          text: '먼저 손을 뻗었지만 반복은 너보다 빠르다. 같은 공격이 수천 번 되돌아온다.\n체력이 깎였다.',
          choices: [{ label: '자세를 낮추고 조건문을 본다', next: 'e3_read' }],
        },
        {
          id: 'e3_pull',
          text: '"하지만 너는…"\n너는 반복문의 심장에 손을 넣어 `break;` 를 뽑아낸다.\n\n"…무한루프에 빠지겠지."\n\n괴물이 처음으로 멈칫한다.',
          choices: [{ label: '뒤로 물러선다', next: 'e3_boom' }],
        },
        {
          id: 'e3_boom',
          speaker: '무한루프',
          text: '"안 돼… 소스코드가… 멈추지 않아…!"\n스스로를 끝없이 호출하며 그것이 안쪽으로 무너진다. 스택이 넘치고, 지하 모듈이 통째로 조용해진다.',
          choices: [],
          ending: {
            kind: 'final',
            title: '탈출 조건',
            text: '모든 반복에는 끝나는 조건이 필요하다. 그것을 쥔 쪽이 이긴다.',
          },
        },
        {
          id: 'e3_false',
          text: '조건을 `false` 로 바꾸자 괴물이 그 자리에서 굳는다.\n죽은 것은 아니다. 다음 배포 때 누군가 되돌리면 다시 일어설 것이다.',
          choices: [],
          ending: {
            kind: 'final',
            title: '임시 조치',
            text: '멈추기는 했다. 끝난 것은 아니다.',
          },
        },
        {
          id: 'e3_retreat',
          text: '너는 물러났고, 반복은 계속된다.\n다음 사람이 이 자리에 앉을 것이다.',
          choices: [],
          ending: {
            kind: 'fail',
            title: '다음 사람에게',
            text: '미룬 문제는 사라지지 않는다. 담당자만 바뀐다.',
          },
        },
      ],
    },
  ],
};
