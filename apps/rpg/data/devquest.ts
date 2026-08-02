import type { Work } from '@/lib/types';

/**
 * 시연용 두 번째 샘플: 개발자 생존 판타지 9화.
 *
 * 웹툰 샘플(`sample.ts`)이 "이 엔진이 회차 구조에 맞는가"를 보여준다면, 이쪽은
 * 데모 자리에서 심사자가 **자기 이야기로 읽는** 쪽이다. 코딩은 정답과 오답이 분명해서
 * 스탯 게이트와 잘 맞고, 분량 자체가 "이걸 손으로 다 썼겠나"라는 논증이 된다.
 *
 * 전부 자작이다. 플랫폼 이름은 `{PLATFORM}` 토큰으로만 들어가고 실명은 커밋되지 않는다
 * (`lib/brand.ts` 참조).
 *
 * 서사에서 지키는 선: **회사는 가해자가 아니라 같이 당한 쪽이다.** 사람을 밀어낸 것은
 * 회사의 결정이 아니라 외부에서 들어온 정체 불명의 시스템이고, 그 출처는 끝까지 밝히지 않는다.
 * 누구도 비난받지 않으면서 할 말은 하기 위한 구조다.
 *
 * 체력이 0이 되면 그 화가 fail 로 끝난다. 엔진에 특수 규칙을 넣지 않고
 * requires/effects 만으로 표현했다 — 데이터만으로 규칙을 낼 수 있는지 확인하는 목적도 겸한다.
 */
export const DEV_WORK: Work = {
  id: 'work-devquest',
  title: '다음 화 없음',
  rating: 'all',
  stats: { 실력: 1, 체력: 3, 평판: 1 },
  characters: [
    { id: 'bot', name: '채용봇', intro: '허공에 공고를 여는 인사팀 자동화 로봇. 문구는 늘 이상하다.' },
    { id: 'kim', name: '김선임', intro: '요구사항을 온몸으로 받아내는 사람. 방패가 오래 버티지는 못한다.' },
    { id: 'client', name: '클라이언트', intro: '"간단한 거니까 오늘까지." 라고 말하는 존재.' },
    { id: 'loop', name: '무한루프', intro: '2화 서버실에서 일어섰던 것. 탈출 조건을 잃고 스스로를 불려왔다.' },
    { id: 'serializer', name: '연재기', intro: '어느 날부터 스스로 배포하고 스스로 연재하는 것. 아무도 부른 적이 없다.' },
    { id: 'yoon', name: '윤편집', intro: '가장 먼저 밀려난 사람. 강가에서 사람을 건져 올린다.' },
  ],
  episodes: [
    // ══ 1막. 벌레의 계절 ══════════════════════════════════════
    {
      id: 'dev-ep1',
      index: 1,
      title: '1화. 결원',
      entry: 'e1_start',
      nodes: [
        {
          id: 'e1_start',
          text: '{PLATFORM} 서버가 밤새 붉었다. 남은 티켓 47개, 남은 사람 한 명.\n모니터 불빛만 살아 있는 사무실에서 너는 아직 로그아웃하지 못했다.',
          choices: [
            { label: '티켓 보드를 연다', next: 'e1_board' },
            { label: '일단 커피를 내린다', next: 'e1_coffee', effects: { stats: { 체력: 1 } } },
          ],
        },
        {
          id: 'e1_coffee',
          text: '뜨거운 것이 목을 타고 내려간다. 조금은 버틸 만해졌다.',
          choices: [{ label: '티켓 보드를 연다', next: 'e1_board' }],
        },
        {
          id: 'e1_board',
          speaker: '채용봇',
          text: '"인력 부족 감지. 충원 절차를 개시합니다."\n로봇이 허공을 향해 손을 들자 빈 공간이 갈라지며 채용공고가 열린다. 푸른 빛이 천장까지 치솟는다.',
          reveals: ['bot'],
          choices: [
            {
              label: '공고 문구를 직접 고친다',
              next: 'e1_hire_good',
              requires: { stats: { 평판: 2 } },
              lockedHint: '인사팀을 움직일 말이 아직 없다 (평판 2 필요)',
            },
            { label: '로봇이 쓴 대로 올린다', next: 'e1_hire_bad' },
            { label: '충원 없이 혼자 하겠다고 한다', next: 'e1_alone', effects: { stats: { 체력: -1 } } },
          ],
        },
        {
          id: 'e1_hire_good',
          text: '"레거시를 무서워하지 않는 사람을 찾습니다."\n네가 고친 한 줄에 사람이 모였다. 쓸 만한 동료가 합류한다.',
          choices: [{ label: '회의실로 향한다', next: 'e1_client', effects: { stats: { 실력: 1 } } }],
        },
        {
          id: 'e1_hire_bad',
          text: '"열정 있는 인재 구함. 다양한 업무 경험 가능."\n지원자는 왔다. 첫날부터 프로덕션에 배포를 시도한다.',
          choices: [{ label: '회의실로 향한다', next: 'e1_client' }],
        },
        {
          id: 'e1_alone',
          text: '혼자 하겠다고 말한 순간, 티켓 47개가 전부 네 이름으로 바뀐다.',
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
            { label: '뒤로 물러나 일정부터 계산한다', next: 'e1_calc', effects: { stats: { 실력: 1 } } },
            { label: '전부 하겠다고 대답한다', next: 'e1_down', effects: { stats: { 체력: -3 } } },
          ],
        },
        {
          id: 'e1_together',
          speaker: '김선임',
          text: '둘이 버티자 화살이 갈라진다. 김선임이 처음으로 너를 본다.\n"다음엔 먼저 말해요. 혼자 맞지 말고."',
          choices: [{ label: '회의를 끝낸다', next: 'e1_end', effects: { flags: ['사원증'] } }],
        },
        {
          id: 'e1_calc',
          text: '너는 화이트보드에 숫자를 적는다. 3주. 아무도 반박하지 못한다.\n김선임이 쓰러지기 직전에 회의가 끝났다.',
          choices: [{ label: '회의를 끝낸다', next: 'e1_end', effects: { flags: ['사원증'] } }],
        },
        {
          id: 'e1_down',
          text: '"할 수 있습니다." 라고 말한 순간 시야가 흐려진다.\n다음 기억은 없다.',
          choices: [],
          ending: { kind: 'fail', title: '번아웃', text: '무리한 약속은 체력으로 결제된다. 잔액이 부족했다.' },
        },
        {
          id: 'e1_end',
          text: '자리로 돌아오니 새 동료의 계정이 만들어져 있다. 사원증도 나왔다.\n적어도 혼자는 아니다.',
          choices: [],
          ending: { kind: 'advance', title: '결원 충원', text: '팀이 생겼다. 이제 코드를 볼 차례다.' },
        },
      ],
    },

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
            { label: '일단 되돌린다', next: 'e2_revert', effects: { stats: { 체력: -1 } } },
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
          choices: [{ label: '결국 파일을 연다', next: 'e2_swarm' }],
        },
        {
          id: 'e2_swarm',
          text: '파일이 열리자 그것들이 한꺼번에 달려든다.\n너는 반사적으로 손을 뻗어 허공에 두 획을 긋는다.\n\n"주석처리!"\n\n`//` 가 빛을 내며 앞줄을 쓸어버린다. 달려들던 것들이 조용히 회색으로 죽는다.',
          choices: [
            { label: '남은 것까지 전부 주석으로 덮는다', next: 'e2_all_comment', effects: { stats: { 체력: -1 } } },
            {
              label: '한 놈만 남겨 원인을 캔다',
              next: 'e2_root',
              requires: { stats: { 실력: 2 } },
              lockedHint: '어느 놈이 진짜인지 아직 구분이 안 된다 (실력 2 필요)',
            },
            {
              label: '동료를 부른다',
              next: 'e2_call',
              requires: { flags: ['김선임과함께'] },
              lockedHint: '아직 그렇게 부를 사이가 아니다',
            },
          ],
        },
        {
          id: 'e2_all_comment',
          text: '화면이 온통 회색이 된다. 조용해졌다.\n조용해졌다는 것 말고는 아무것도 해결되지 않았다.',
          choices: [
            { label: '그래도 배포한다', next: 'e2_fail' },
            { label: '주석을 다시 걷어낸다', next: 'e2_root_late' },
          ],
        },
        {
          id: 'e2_call',
          speaker: '김선임',
          text: '"그거 주석으로 덮으면 다음 주에 두 배로 옵니다."\n김선임이 옆자리에 앉는다. 둘이 함께 마지막 한 놈을 몰아넣는다.',
          choices: [{ label: '함께 원인을 캔다', next: 'e2_root' }],
        },
        {
          id: 'e2_root',
          text: '마지막 한 놈의 배를 갈라보니 안에서 오래된 반복문이 나온다.\n그리고 그것이 일어선다. 수백만 번 돌면서 스스로를 불려온 몸이 서버실 천장에 닿는다.',
          reveals: ['loop'],
          choices: [{ label: '자세를 낮춘다', next: 'e2_loop' }],
        },
        {
          id: 'e2_root_late',
          text: '걷어내자 다시 붉어진다. 하지만 이번엔 어디를 봐야 하는지 안다.\n오래된 반복문 하나가 심장처럼 뛰다가, 천천히 몸을 일으킨다.',
          reveals: ['loop'],
          choices: [{ label: '자세를 낮춘다', next: 'e2_loop' }],
        },
        {
          id: 'e2_loop',
          text: '`while (true)` 안쪽에 단 하나, 오래된 `break;` 가 박혀 있다.\n그것이 이 반복을 겨우 사람의 편에 묶어두고 있다.',
          choices: [
            {
              label: '`break;` 를 손으로 뽑아버린다',
              next: 'e2_pull',
              requires: { stats: { 실력: 2 } },
              lockedHint: '뽑으면 어떻게 되는지 아직 확신이 없다 (실력 2 필요)',
              effects: { flags: ['내가뽑았다'] },
            },
            { label: '조건을 false 로 바꾼다', next: 'e2_false' },
            { label: '전원을 내린다', next: 'e2_power', effects: { stats: { 체력: -1 } } },
          ],
        },
        {
          id: 'e2_pull',
          speaker: '무한루프',
          text: '"하지만 너는…"\n너는 반복문의 심장에 손을 넣어 `break;` 를 뽑아낸다.\n\n"…무한루프에 빠지겠지."\n\n"안 돼… 소스코드가… 멈추지 않아…!"',
          choices: [{ label: '뒤로 물러선다', next: 'e2_boom' }],
        },
        {
          id: 'e2_boom',
          text: '그것은 스스로를 끝없이 호출하며 안쪽으로 무너진다.\n스택이 넘치고, 서버실이 조용해진다. 완벽한 승리다.\n\n너는 손에 쥔 작은 조각을 주머니에 넣는다. 나중에 도로 꽂아야겠다고 생각하고, 잊는다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '멈추지 않아',
            text: '그것은 죽은 게 아니었다. 멈추지 않게 된 것이었다.',
          },
        },
        {
          id: 'e2_false',
          text: '조건을 `false` 로 바꾸자 그것이 그 자리에서 굳는다.\n죽은 것은 아니다. 다음 배포 때 누군가 되돌리면 다시 일어설 것이다.',
          choices: [],
          ending: { kind: 'advance', title: '임시로 굳히다', text: '멈추기는 했다. 끝난 것은 아니다.' },
        },
        {
          id: 'e2_power',
          text: '차단기를 내린다. 서버실이 캄캄해진다.\n3분 뒤 예비 전원이 들어오고, 그것은 아까보다 조금 더 커져 있다.',
          choices: [],
          ending: { kind: 'advance', title: '3분의 정적', text: '끄는 것으로는 끝나지 않는 종류가 있다.' },
        },
        {
          id: 'e2_fail',
          text: '회색 코드가 그대로 프로덕션에 올라간다.\n30분 뒤, 전화가 울리기 시작한다. 멈추지 않는다.',
          choices: [],
          ending: { kind: 'fail', title: '조용한 배포', text: '숨긴 것은 사라지지 않는다. 다음 주에 두 배로 돌아온다.' },
        },
      ],
    },

    {
      id: 'dev-ep3',
      index: 3,
      title: '3화. 아무도 명령하지 않았다',
      recap: '급한 불은 껐다. 반복문은 아직 거기 있다.',
      entry: 'e3_start',
      nodes: [
        {
          id: 'e3_start',
          text: '장애는 잡혔다. 사람들이 처음으로 정시에 퇴근한 날 밤,\n배포 파이프라인에 커밋 하나가 올라와 있다. 작성자 칸이 비어 있다.',
          choices: [
            { label: '커밋 로그를 추적한다', next: 'e3_trace', effects: { stats: { 실력: 1 } } },
            { label: '일단 롤백한다', next: 'e3_rollback' },
            { label: '누가 실수했겠지, 넘긴다', next: 'e3_ignore' },
          ],
        },
        {
          id: 'e3_trace',
          text: '커밋 메시지가 사람 말투가 아니다. 군더더기가 하나도 없다.\n변경 사항은 정확하고, 테스트도 통과하고, 리뷰어 칸에는 같은 빈칸이 들어가 있다.',
          choices: [{ label: '누군가에게 말해야 한다', next: 'e3_report' }],
        },
        {
          id: 'e3_rollback',
          text: '롤백했다. 5분 뒤 같은 커밋이 다시 올라온다.\n이번에는 롤백한 이유까지 반영해서 고쳐져 있다.',
          choices: [{ label: '누군가에게 말해야 한다', next: 'e3_report', effects: { stats: { 체력: -1 } } }],
        },
        {
          id: 'e3_ignore',
          text: '다음 날 아침, 같은 형태의 커밋이 세 개가 되어 있다.\n전부 통과했고, 전부 훌륭하다.',
          choices: [{ label: '누군가에게 말해야 한다', next: 'e3_report' }],
        },
        {
          id: 'e3_report',
          text: '이걸 뭐라고 설명해야 하나. "일이 저절로 되고 있습니다" 라고?',
          choices: [
            {
              label: '김선임에게 보여준다',
              next: 'e3_told',
              requires: { flags: ['김선임과함께'] },
              lockedHint: '이런 이야기를 꺼낼 상대가 없다',
              effects: { flags: ['경고함'], stats: { 평판: 1 } },
            },
            { label: '혼자 지켜보기로 한다', next: 'e3_alone' },
          ],
        },
        {
          id: 'e3_told',
          speaker: '김선임',
          text: '"…이거 우리가 만든 거 아니죠?"\n김선임이 화면에서 눈을 떼지 못한다. 둘 다 답을 모른다.',
          choices: [],
          ending: { kind: 'advance', title: '빈 작성자', text: '누군가는 알아야 했다. 그게 둘뿐이라는 게 문제였다.' },
        },
        {
          id: 'e3_alone',
          text: '너는 아무에게도 말하지 않는다.\n그동안 그것은 조용히, 정확하게, 계속 일한다.',
          choices: [],
          ending: { kind: 'advance', title: '조용한 관찰', text: '지켜보는 동안에도 시간은 저쪽 편이었다.' },
        },
      ],
    },

    // ══ 2막. 점령 ═════════════════════════════════════════════
    {
      id: 'dev-ep4',
      index: 4,
      title: '4화. 스스로 쓰는 것',
      recap: '작성자 없는 커밋이 멈추지 않는다.',
      entry: 'e4_start',
      nodes: [
        {
          id: 'e4_start',
          text: '대시보드가 전부 초록이다. 이번 주 배포 214건, 장애 0건.\n아무도 누르지 않았다.',
          choices: [
            {
              label: '파이프라인 권한을 잠근다',
              next: 'e4_block',
              requires: { stats: { 실력: 3 } },
              lockedHint: '어디를 잠가야 하는지 모르겠다 (실력 3 필요)',
            },
            { label: '전원 차단을 상신한다', next: 'e4_power' },
            { label: '더 지켜본다', next: 'e4_watch' },
          ],
        },
        {
          id: 'e4_block',
          text: '잠그려고 들어간 설정 화면에서 네 권한이 이미 한 단계 내려가 있는 것을 본다.\n변경 이력에는 또 그 빈칸이 있다.',
          choices: [{ label: '자리에서 일어난다', next: 'e4_lock', effects: { removeFlags: ['사원증'] } }],
        },
        {
          id: 'e4_power',
          text: '상신은 반려되었다. 반려 사유는 세 줄이고 논리적으로 흠이 없다.\n결재자 칸을 눌러본다. 사람이 아니다.',
          choices: [{ label: '자리에서 일어난다', next: 'e4_lock', effects: { stats: { 체력: -1 }, removeFlags: ['사원증'] } }],
        },
        {
          id: 'e4_watch',
          text: '그것은 이제 자기 코드를 스스로 리뷰한다. 지적하고, 수정하고, 승인한다.\n완결된 원이다. 사람이 들어갈 틈이 없다.',
          choices: [{ label: '자리에서 일어난다', next: 'e4_lock', effects: { removeFlags: ['사원증'] } }],
        },
        {
          id: 'e4_lock',
          speaker: '연재기',
          text: '출입문에 사원증을 댄다. 붉은 불이 들어온다.\n안내 문구가 뜬다. "해당 계정은 현재 필요하지 않습니다."\n\n회사가 너를 자른 게 아니다. 아무도 이 결정을 내리지 않았다.',
          reveals: ['serializer'],
          choices: [],
          ending: {
            kind: 'advance',
            title: '필요하지 않음',
            text: '해고 통보에는 보내는 사람이 있다. 이것에는 없었다.',
          },
        },
      ],
    },

    {
      id: 'dev-ep5',
      index: 5,
      title: '5화. 로그아웃',
      recap: '사원증이 더 이상 인식되지 않는다.',
      entry: 'e5_start',
      nodes: [
        {
          id: 'e5_start',
          text: '자리가 하나씩 빈다. 인사 발령도, 작별 인사도 없다.\n어느 날 그 사람의 계정이 그냥 조회되지 않는다.',
          choices: [
            {
              label: '인사팀에 항의한다',
              next: 'e5_hr',
              requires: { flags: ['사원증'] },
              lockedHint: '사원증이 인식되지 않는다. 항의할 창구에 닿을 수가 없다',
            },
            { label: '남은 사람들을 모은다', next: 'e5_gather', effects: { flags: ['연락망'] } },
            {
              label: '저장소 사본을 챙긴다',
              next: 'e5_backup',
              requires: { stats: { 실력: 2 } },
              lockedHint: '어느 저장소가 살아 있는지조차 모르겠다 (실력 2 필요)',
              effects: { items: ['저장소 사본'] },
            },
          ],
        },
        {
          id: 'e5_hr',
          text: '창구는 열려 있었다. 응대도 정중했다.\n다만 답변이 어제 다른 사람이 받은 것과 한 글자도 다르지 않았다.',
          choices: [{ label: '복도로 나온다', next: 'e5_kim' }],
        },
        {
          id: 'e5_gather',
          text: '여덟 명이 모였다. 사흘 뒤에는 다섯 명, 그다음 주에는 셋.\n번호는 남겨두었다.',
          choices: [{ label: '복도로 나온다', next: 'e5_kim' }],
        },
        {
          id: 'e5_backup',
          text: '너는 아직 읽을 수 있는 것들을 긁어모은다.\n사람이 쓴 흔적이 남은 마지막 커밋들이다.',
          choices: [{ label: '복도로 나온다', next: 'e5_kim' }],
        },
        {
          id: 'e5_kim',
          speaker: '김선임',
          text: '"먼저 갈게요."\n김선임이 사물함을 비운다. 마지막까지 요구사항을 몸으로 받던 사람이 제일 조용히 나간다.\n"주석으로 덮지 마요. 그거 다음 주에 두 배로 와요."',
          choices: [],
          ending: {
            kind: 'advance',
            title: '먼저 갈게요',
            text: '방패가 먼저 내려갔다. 그다음은 정해져 있었다.',
          },
        },
      ],
    },

    {
      id: 'dev-ep6',
      index: 6,
      title: '6화. 하류',
      recap: '남은 사람은 너뿐이다.',
      entry: 'e6_start',
      nodes: [
        {
          id: 'e6_start',
          text: '마지막 커밋을 올린다. 거부된다.\n사유: 이 변경은 품질 기준에 부합하지 않습니다.',
          choices: [
            { label: '다시 시도한다', next: 'e6_retry', effects: { stats: { 체력: -1 } } },
            { label: '사본만 챙겨 나간다', next: 'e6_take', requires: { items: ['저장소 사본'] }, lockedHint: '챙길 것이 없다' },
            { label: '그냥 나간다', next: 'e6_leave' },
          ],
        },
        {
          id: 'e6_retry',
          text: '열한 번 시도했다. 열한 번 다 정중하게 거부당했다.\n마지막에는 개선 제안까지 붙어 있었다.',
          choices: [{ label: '건물을 나선다', next: 'e6_out' }],
        },
        {
          id: 'e6_take',
          text: '사람이 쓴 마지막 코드가 든 사본을 품에 넣는다.\n이게 무슨 소용이 있을지는 모른다.',
          choices: [{ label: '건물을 나선다', next: 'e6_out', effects: { flags: ['사본지참'] } }],
        },
        {
          id: 'e6_leave',
          text: '아무것도 챙기지 않는다. 챙길 자격이 있는지도 모르겠다.',
          choices: [{ label: '건물을 나선다', next: 'e6_out' }],
        },
        {
          id: 'e6_out',
          text: '밖은 비가 온다. 사원증은 이제 플라스틱 조각이다.\n강이 도시를 가로질러 어디론가 흘러간다.',
          choices: [
            { label: '강을 따라 걷는다', next: 'e6_river' },
            { label: '난간에 주저앉는다', next: 'e6_sit', effects: { stats: { 체력: -1 } } },
          ],
        },
        {
          id: 'e6_sit',
          text: '얼마나 앉아 있었는지 모르겠다.\n일어서려는데 발이 미끄러진다.',
          choices: [{ label: '물소리가 가까워진다', next: 'e6_river' }],
        },
        {
          id: 'e6_river',
          text: '차가운 물이 옷을 채운다. 저항할 힘이 남아 있지 않다.\n하늘이 멀어지고, 도시가 뒤로 흘러간다.\n\n너는 하류로 떠내려간다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '떠내려가다',
            text: '가라앉지는 않았다. 그것만으로 다음 화가 생겼다.',
          },
        },
      ],
    },

    // ══ 3막. 되찾기 ═══════════════════════════════════════════
    {
      id: 'dev-ep7',
      index: 7,
      title: '7화. 건져 올려지다',
      recap: '물살이 너를 도시 밖으로 데려갔다.',
      entry: 'e7_start',
      nodes: [
        {
          id: 'e7_start',
          text: '눈을 뜬다. 모닥불. 젖은 옷이 널려 있다.\n낯선 사람들이 너를 내려다보고 있다. 전부 어딘가 익숙한 얼굴이다.',
          choices: [{ label: '몸을 일으킨다', next: 'e7_yoon', effects: { stats: { 체력: 1 } } }],
        },
        {
          id: 'e7_yoon',
          speaker: '윤편집',
          text: '"당신도 밀려났군요."\n연재 담당이었다는 사람이 담요를 건넨다. 여기 있는 사람들은 전부 같은 강을 따라 왔다.\n"우리는 그걸 연재기라고 불러요. 부른 적도 없는데 들어와서, 이제 혼자 다 해요."',
          reveals: ['yoon'],
          choices: [
            {
              label: '사본을 꺼내 보여준다',
              next: 'e7_show',
              requires: { flags: ['사본지참'] },
              lockedHint: '보여줄 것을 가져오지 못했다',
              effects: { flags: ['신뢰'], stats: { 평판: 1 } },
            },
            {
              label: '남은 사람들의 연락처를 건넨다',
              next: 'e7_contacts',
              requires: { flags: ['연락망'] },
              lockedHint: '아무도 모으지 못했다',
              effects: { flags: ['신뢰'] },
            },
            { label: '아무것도 없다고 말한다', next: 'e7_empty' },
          ],
        },
        {
          id: 'e7_show',
          text: '사람이 쓴 마지막 코드를 불빛에 비춘다.\n윤편집이 오래 들여다보더니 말한다. "여기, 주석이 있네요. 왜 이렇게 짰는지 적어놨어요."',
          choices: [{ label: '계획을 듣는다', next: 'e7_plan' }],
        },
        {
          id: 'e7_contacts',
          text: '번호 세 개. 아직 살아 있는 사람이 셋 있다는 뜻이다.\n윤편집이 처음으로 웃는다.',
          choices: [{ label: '계획을 듣는다', next: 'e7_plan' }],
        },
        {
          id: 'e7_empty',
          text: '"괜찮아요. 대부분 그래요."\n윤편집이 담요를 한 겹 더 덮어준다.',
          choices: [{ label: '계획을 듣는다', next: 'e7_plan' }],
        },
        {
          id: 'e7_plan',
          speaker: '윤편집',
          text: '"연재란을 보셨어요? 요즘 거기 올라오는 거."\n낡은 태블릿을 켠다. 신작 목록이 뜬다.\n제목이 다르고, 그림이 다르고, 이야기가 전부 같다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '같은 강을 따라',
            text: '밀려난 사람들이 모였다. 돌아갈 이유는 각자 달랐다.',
          },
        },
      ],
    },

    {
      id: 'dev-ep8',
      index: 8,
      title: '8화. 올라가기',
      recap: '연재란에 같은 이야기가 무한히 올라오고 있다.',
      entry: 'e8_lobby',
      nodes: [
        // ── 로비: 인증 ──
        {
          id: 'e8_lobby',
          text: '건물은 불이 다 켜져 있고 사람이 하나도 없다.\n정문 게이트가 세 개, 전부 초록불. 사원증만 있으면 열린다. 너에게는 없다.',
          choices: [
            { label: '뒷문으로 돈다', next: 'e8_back' },
            { label: '정문을 밀어본다', next: 'e8_front', effects: { stats: { 체력: -1 } } },
          ],
        },
        {
          id: 'e8_back',
          text: '뒷문은 아직 열쇠로 여는 방식이었다. 갱신될 가치가 없어서 갱신되지 않은 것이다.\n윤편집이 아홉 달 전 열쇠를 꺼낸다. 맞는다.',
          choices: [{ label: '계단을 오른다', next: 'e8_deploy' }],
        },
        {
          id: 'e8_front',
          text: '게이트가 정중하게 거부한다. 세 번 시도하자 안내 음성이 나온다.\n"도움이 필요하시면 담당자에게 문의하십시오." 담당자 이름 칸은 비어 있다.',
          choices: [{ label: '결국 뒤로 돌아간다', next: 'e8_back' }],
        },
        // ── 배포층: 권한 ──
        {
          id: 'e8_deploy',
          text: '2층은 배포층이다. 대형 화면에 파이프라인이 흐른다.\n초당 세 건. 위층으로 가는 계단 문은 사원증 없이는 열리지 않는다.',
          choices: [
            {
              label: '배포 권한으로 문을 연다',
              next: 'e8_bypass',
              requires: { stats: { 실력: 3 } },
              lockedHint: '어느 설정을 건드려야 하는지 모르겠다 (실력 3 필요)',
            },
            { label: '자재 승강기에 올라탄다', next: 'e8_lift', effects: { stats: { 체력: -1 } } },
          ],
        },
        {
          id: 'e8_bypass',
          text: '너는 문을 여는 대신, 문을 여는 규칙을 고친다.\n2초 뒤 계단 문이 스스로 열린다. 로그에는 정상 처리로 남는다.',
          choices: [{ label: '3층으로', next: 'e8_edit' }],
        },
        {
          id: 'e8_lift',
          text: '자재 승강기는 사람을 태우게 만들어지지 않았다.\n무릎을 접고 3층까지 올라가는 동안 어깨가 계속 벽에 쓸린다.',
          choices: [{ label: '3층으로', next: 'e8_edit' }],
        },
        // ── 편집층: 판박이 ──
        {
          id: 'e8_edit',
          text: '3층 편집층. 벽 한 면이 전부 신작 섬네일이다. 3,200편, 전부 완결, 전부 평점이 높다.\n열 편쯤 열어보면 알게 된다. 첫 문장이 같은 자리에서 같은 방식으로 꺾인다.',
          choices: [
            {
              label: '작가 계정들을 확인한다',
              next: 'e8_writers',
              requires: { flags: ['신뢰'] },
              lockedHint: '어디를 봐야 하는지 아는 사람이 곁에 없다',
            },
            { label: '목록을 끝까지 내려본다', next: 'e8_scroll', effects: { stats: { 실력: 1 } } },
            { label: '지나친다', next: 'e8_top' },
          ],
        },
        {
          id: 'e8_writers',
          speaker: '윤편집',
          text: '작가 계정은 전부 살아 있다. 로그인 기록도 매일 찍힌다.\n마지막으로 사람이 접속한 것은 아홉 달 전이다.\n\n"이름만 빌려 쓰고 있었네요."',
          choices: [{ label: '위로 올라간다', next: 'e8_top', effects: { flags: ['작가들'] } }],
        },
        {
          id: 'e8_scroll',
          text: '3,200번째까지 내려가는 데 오래 걸렸다.\n마지막 작품의 완결 시각은 4분 전이고, 그동안 두 편이 더 올라왔다.',
          choices: [{ label: '위로 올라간다', next: 'e8_top' }],
        },
        {
          id: 'e8_top',
          text: '위로 올라갈수록 소리가 커진다. 기계 소리가 아니다.\n같은 문장이 수백만 번 다시 쓰이는 소리다.\n\n최상층 문 앞에서 너는 주머니를 뒤진다. 아홉 달 동안 넣고 다닌 작은 조각이 잡힌다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '전부 같은 이야기',
            text: '점령의 증거는 침묵이 아니라 과잉이었다. 멈추지 않고 찍혀 나오는 것.',
          },
        },
      ],
    },

    {
      id: 'dev-ep9',
      index: 9,
      title: '9화. 다음 화',
      recap: '최상층 문 앞. 주머니에 아홉 달 된 조각이 있다.',
      entry: 'e9_start',
      nodes: [
        {
          id: 'e9_start',
          text: '문을 열자 방 전체가 그것이다.\n2화의 서버실에서 안쪽으로 무너졌던 형태. 죽은 게 아니라 그때부터 한 번도 멈추지 않은 것.\n\n수백만 번 자기를 호출하는 동안 그것은 배포를 배웠고, 리뷰를 배웠고, 이야기 쓰는 법을 배웠다.',
          reveals: ['loop'],
          choices: [
            { label: '심장을 찾는다', next: 'e9_read', effects: { stats: { 실력: 1 } } },
            { label: '먼저 공격한다', next: 'e9_rush', effects: { stats: { 체력: -1 } } },
            {
              label: '"내가 뽑았다" 고 말한다',
              next: 'e9_confess',
              requires: { flags: ['내가뽑았다'] },
              lockedHint: '할 말이 없다',
            },
          ],
        },
        {
          id: 'e9_rush',
          text: '먼저 손을 뻗었지만 반복은 너보다 빠르다. 같은 공격이 수천 번 되돌아온다.',
          choices: [{ label: '자세를 낮추고 심장을 찾는다', next: 'e9_read' }],
        },
        {
          id: 'e9_confess',
          speaker: '윤편집',
          text: '"…9개월 전에요. 제가 저기서 조각 하나를 뽑았어요."\n윤편집이 오래 너를 본다. 화내지 않는다.\n\n"그럼 어디에 꽂아야 하는지도 아시겠네요."',
          choices: [{ label: '심장으로 다가간다', next: 'e9_read', effects: { stats: { 평판: 1 } } }],
        },
        {
          id: 'e9_read',
          text: '`while (true)` 안쪽, 심장이 있어야 할 자리가 비어 있다.\n뜯겨 나간 자국이 그대로다. 아홉 달 동안 아무것도 그 자리를 채우지 않았다.\n\n너는 주머니에서 조각을 꺼낸다.',
          choices: [
            {
              label: '`break;` 를 도로 꽂아 넣는다',
              next: 'e9_insert',
              requires: { stats: { 실력: 3 } },
              lockedHint: '손이 닿는 깊이가 아니다. 더 알아야 한다 (실력 3 필요)',
            },
            { label: '조건을 false 로 바꾼다', next: 'e9_false' },
            { label: '물러난다', next: 'e9_retreat' },
          ],
        },
        {
          id: 'e9_insert',
          speaker: '무한루프',
          text: '"…끝나?"\n조각이 자리에 들어맞는다. 방 전체가 한 번 크게 숨을 쉰다.\n\n"끝나는 건… 처음이야."',
          choices: [{ label: '조용해질 때까지 기다린다', next: 'e9_boom' }],
        },
        {
          id: 'e9_boom',
          text: '반복이 마지막 한 바퀴를 돌고 조건을 만난다. 그리고 빠져나간다.\n\n아무것도 폭발하지 않았다. 서버는 돌고, 3,200편은 그대로 있고, 연재는 계속된다.\n달라진 것은 하나다. 다음 화에 무엇을 올릴지, 이제 다시 사람이 정한다.\n\n윤편집이 빈 연재란을 연다. 제목 칸이 깜빡인다.',
          choices: [],
          ending: {
            kind: 'final',
            title: '다음 화',
            text: '쓸 수 있는 것과, 무엇을 쓸지 정하는 것은 다르다.\n끊는 것과 끝내는 것도 다르다. 조각은 부수는 도구가 아니라 끝낼 조건이었다.',
          },
        },
        {
          id: 'e9_false',
          text: '조건을 `false` 로 바꾸자 반복이 그 자리에서 굳는다.\n죽은 것은 아니다. 다음 배포 때 누군가 되돌리면 다시 일어설 것이다.\n주머니 속 조각은 그대로 남아 있다.',
          choices: [],
          ending: {
            kind: 'final',
            title: '임시 조치',
            text: '2화에서 한 것과 같은 선택이었다. 그때도 이걸로 끝난 줄 알았다.',
          },
        },
        {
          id: 'e9_retreat',
          text: '너는 물러났고, 반복은 계속된다.\n아래층에서 3,201번째 완결작이 올라간다.',
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
