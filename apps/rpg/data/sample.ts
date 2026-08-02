import type { Work } from '@/lib/types';

/**
 * 구조 검증용 **자작 가상 웹툰** 시드.
 *
 * 실제 작품 데이터는 이 레포에 커밋하지 않는다 — 저작권과 사내 기획 노출 문제 때문이다.
 * 실작품 에피소드는 관리자 화면의 JSON 내보내기/가져오기로 로컬에서만 다룬다.
 *
 * 이 시드가 증명해야 하는 것:
 *   1) 스탯 게이트 — 요구치 미달 선택지가 **보이지만 잠긴 채로** 남는다
 *   2) 분기 — 같은 목표를 다른 방법으로 달성하면 다른 플래그가 남는다
 *   3) 콜백 — 2·3화가 1화에서 남긴 플래그를 조건으로 다른 장면을 연다
 *   4) 엔딩 — advance(다음 화) / fail(재시작) / final(완결)
 */
export const SAMPLE_WORK: Work = {
  id: 'ashford',
  title: '재의 여울',
  rating: 'all',
  stats: { 설득: 1, 무력: 1, 통찰: 1 },
  characters: [
    { id: 'toran', name: '토란', intro: '변경 마을의 대장장이. 갚지 못한 빚이 있다.' },
    { id: 'ire', name: '이레', intro: '숲을 도는 사냥꾼. 여울에서 무언가를 봤다고 한다.' },
    { id: 'hollow', name: '재의 것', intro: '여울 바닥에서 올라온 것. 이름을 잃었다.' },
  ],
  episodes: [
    // ── 1화 ────────────────────────────────────────────────
    {
      id: 'ep1',
      index: 1,
      title: '1화 — 마른 여울',
      entry: 'e1_start',
      nodes: [
        {
          id: 'e1_start',
          text: '여울이 마른 지 열흘째다. 물이 빠진 바닥에서 재 냄새가 올라온다.\n마을을 떠나려면 동행이 필요하다. 이 마을에서 여울로 갈 사람은 둘뿐이다.',
          choices: [
            { label: '대장간으로 간다', next: 'e1_forge' },
            { label: '숲 어귀로 간다', next: 'e1_woods' },
          ],
        },

        // 토란 라인
        {
          id: 'e1_forge',
          speaker: '토란',
          text: '"여울? 미쳤군. 저기서 올라온 게 뭔지도 모르면서."\n망치를 내려놓지도 않고 그가 말한다. 작업대 밑에 접힌 차용증이 보인다.',
          reveals: ['toran'],
          choices: [
            {
              label: '빚을 대신 갚아주겠다고 한다',
              requires: { stats: { 설득: 2 } },
              lockedHint: '설득 2 필요 — 아직 그를 설득할 말을 못 찾았다',
              effects: { flags: ['toran_debt'], stats: { 설득: 1 } },
              next: 'e1_toran_join',
            },
            {
              label: '차용증을 집어 든다',
              effects: { flags: ['toran_threat'], stats: { 무력: 1 } },
              next: 'e1_toran_join',
            },
            { label: '나중에 오겠다고 한다', next: 'e1_start' },
          ],
        },
        {
          id: 'e1_toran_join',
          speaker: '토란',
          text: '토란이 망치를 내려놓는다.\n"…좋아. 대신 내가 앞장선다. 뒤에서 뭘 하든 상관 안 해."',
          choices: [
            { label: '숲 어귀로 간다', requires: { notFlags: ['ire_join'] }, next: 'e1_woods' },
            { label: '여울로 출발한다', requires: { flags: ['ire_join'] }, next: 'e1_depart' },
            { label: '혼자 여울로 간다', next: 'e1_alone' },
          ],
        },

        // 이레 라인
        {
          id: 'e1_woods',
          speaker: '이레',
          text: '"봤어요. 물이 빠지던 밤에."\n활을 손질하던 손이 멈춘다. "바닥에 뭔가 서 있었어요. 사람 모양으로."',
          reveals: ['ire'],
          choices: [
            {
              label: '무엇을 봤는지 캐묻는다',
              requires: { stats: { 통찰: 2 } },
              lockedHint: '통찰 2 필요 — 그가 숨기는 게 있다는 건 알겠는데 짚이지 않는다',
              effects: { flags: ['ire_join', 'saw_hollow'], items: ['이레의 화살'] },
              next: 'e1_ire_join',
            },
            {
              label: '같이 가자고 한다',
              effects: { flags: ['ire_join'], stats: { 설득: 1 } },
              next: 'e1_ire_join',
            },
            { label: '나중에 오겠다고 한다', next: 'e1_start' },
          ],
        },
        {
          id: 'e1_ire_join',
          speaker: '이레',
          text: '"혼자 가면 죽어요. 둘이 가도 죽고요."\n그가 활을 등에 멘다. "그래도 가야 한다면, 셋이 낫겠죠."',
          choices: [
            { label: '대장간으로 간다', requires: { notFlags: ['toran_debt', 'toran_threat'] }, next: 'e1_forge' },
            {
              label: '여울로 출발한다',
              requires: { flags: ['toran_debt'] },
              next: 'e1_depart',
            },
            {
              label: '여울로 출발한다',
              requires: { flags: ['toran_threat'] },
              next: 'e1_depart',
            },
            { label: '둘이서 간다', next: 'e1_alone' },
          ],
        },

        // 종료 노드
        {
          id: 'e1_depart',
          text: '셋이 마을을 나선다. 마른 바닥에 발자국이 세 줄로 남는다.\n토란이 앞장서고, 이레가 뒤를 본다.',
          choices: [],
          ending: {
            kind: 'advance',
            title: '동행',
            text: '파티를 모았다. 여울로 향한다.',
          },
        },
        {
          id: 'e1_alone',
          text: '여울 바닥은 생각보다 깊었다. 재가 무릎까지 차오른다.\n뒤를 봐줄 사람이 없다는 걸 안 것은, 뒤에서 소리가 났을 때였다.',
          choices: [],
          ending: {
            kind: 'fail',
            title: '혼자 남다',
            text: '동행 없이 여울에 들어섰다. 아무도 돌아오지 않았다.',
          },
        },
      ],
    },

    // ── 2화 ────────────────────────────────────────────────
    {
      id: 'ep2',
      index: 2,
      title: '2화 — 여울 바닥',
      entry: 'e2_start',
      recap: '토란과 이레를 동행으로 얻었다. 셋은 마른 여울로 내려간다.',
      nodes: [
        {
          id: 'e2_start',
          text: '여울 바닥은 마을에서 본 것보다 넓다. 재가 발목을 잡는다.\n앞쪽에 무너진 돌문이 있고, 그 너머는 보이지 않는다.',
          choices: [
            { label: '돌문을 살핀다', next: 'e2_gate' },
            { label: '토란에게 묻는다', next: 'e2_ask_toran' },
          ],
        },
        {
          id: 'e2_ask_toran',
          speaker: '토란',
          text: '토란이 돌문에 손을 얹는다.\n"이건 우리 할아버지 대에 막은 거다. 뭘 막았는지는 아무도 말 안 했지."',
          choices: [
            // 1화 분기 콜백 — 빚을 갚아준 경우에만 열리는 대사
            {
              label: '"왜 나한테는 말해주지?"',
              requires: { flags: ['toran_debt'] },
              effects: { flags: ['toran_trust'], stats: { 통찰: 1 } },
              next: 'e2_toran_trust',
            },
            { label: '돌문을 살핀다', next: 'e2_gate' },
          ],
        },
        {
          id: 'e2_toran_trust',
          speaker: '토란',
          text: '"…빚 갚아준 놈한테 거짓말하면 사람이 아니지."\n그가 처음으로 이쪽을 본다. "문 뒤에 있는 건 사람이었어. 우리가 그렇게 만들었고."',
          choices: [{ label: '돌문을 연다', effects: { stats: { 통찰: 1 } }, next: 'e2_open' }],
        },
        {
          id: 'e2_gate',
          text: '돌문은 안쪽에서 밀어낸 것처럼 부서져 있다.\n틈으로 바람이 나온다. 따뜻하다.',
          choices: [
            {
              label: '힘으로 밀어낸다',
              requires: { stats: { 무력: 2 } },
              lockedHint: '무력 2 필요 — 돌이 꿈쩍도 하지 않는다',
              next: 'e2_open',
            },
            {
              label: '이레에게 화살을 쏘게 한다',
              requires: { items: ['이레의 화살'] },
              lockedHint: '이레의 화살이 필요하다',
              effects: { stats: { 통찰: 1 } },
              next: 'e2_open',
            },
            { label: '틈으로 기어든다', effects: { stats: { 무력: -1 } }, next: 'e2_crawl' },
          ],
        },
        {
          id: 'e2_crawl',
          text: '좁은 틈을 지나며 어깨가 쓸린다. 반대편은 어둡고, 재가 없다.\n뒤에서 토란이 부르는 소리가 멀다.',
          choices: [{ label: '일어선다', next: 'e2_open' }],
        },
        {
          id: 'e2_open',
          text: '문 너머는 물이 마르지 않은 방이었다.\n한가운데 사람 모양의 것이 서 있다. 이쪽을 보고 있다.',
          reveals: ['hollow'],
          choices: [],
          ending: {
            kind: 'advance',
            title: '문 너머',
            text: '여울 바닥의 문을 열었다. 그것과 마주 선다.',
          },
        },
      ],
    },

    // ── 3화 ────────────────────────────────────────────────
    {
      id: 'ep3',
      index: 3,
      title: '3화 — 재의 것',
      entry: 'e3_start',
      recap: '문 너머에서 사람 모양의 것과 마주쳤다.',
      nodes: [
        {
          id: 'e3_start',
          speaker: '재의 것',
          text: '"…이름."\n말이라기보다 재가 갈리는 소리다. "내 이름을 아는 사람이 있었는데."',
          choices: [
            // 1·2화 콜백 — 토란의 신뢰를 얻었을 때만
            {
              label: '"토란이 안다"',
              requires: { flags: ['toran_trust'] },
              effects: { flags: ['named'] },
              next: 'e3_named',
            },
            {
              label: '이레의 목격담을 말한다',
              requires: { flags: ['saw_hollow'] },
              effects: { stats: { 통찰: 1 } },
              next: 'e3_witness',
            },
            { label: '무기를 든다', effects: { flags: ['fought'] }, next: 'e3_fight' },
          ],
        },
        {
          id: 'e3_named',
          speaker: '토란',
          text: '토란이 앞으로 나온다. 목소리가 떨린다.\n"…여울. 네 이름은 여울이었어."\n\n그것이 멈춘다. 재가 무너져 내린다.',
          choices: [],
          ending: {
            kind: 'final',
            title: '이름을 돌려주다',
            text: '이름을 되찾은 것은 물이 되어 여울로 돌아갔다. 마을에 물이 든다.',
          },
        },
        {
          id: 'e3_witness',
          text: '이레가 그날 밤 본 것을 말한다. 그것이 고개를 기울인다.\n"봤구나. 그럼 너는 기억하겠네."\n\n재가 이레 쪽으로 흐른다.',
          choices: [
            { label: '이레를 끌어당긴다', requires: { stats: { 무력: 3 } }, lockedHint: '무력 3 필요', next: 'e3_save' },
            { label: '지켜본다', next: 'e3_lost' },
          ],
        },
        {
          id: 'e3_save',
          text: '이레의 팔을 잡아 끌어낸다. 재가 발밑에서 멈춘다.\n그것은 더 다가오지 않았다. 셋은 물러났다.',
          choices: [],
          ending: {
            kind: 'final',
            title: '물러서다',
            text: '여울은 그대로 두고 마을로 돌아왔다. 물은 돌아오지 않았다.',
          },
        },
        {
          id: 'e3_lost',
          text: '이레가 재 속으로 걸어 들어간다. 뒤도 돌아보지 않는다.',
          choices: [],
          ending: { kind: 'fail', title: '목격자', text: '본 사람은 남지 않는다.' },
        },
        {
          id: 'e3_fight',
          text: '칼이 재를 갈랐다. 아무 저항도 없었다.\n그것이 무너지며 마지막으로 말한다. "…너도 이름을 잃겠구나."',
          choices: [],
          ending: { kind: 'fail', title: '이름 없는 자', text: '이름을 묻지 않은 대가는 나중에 왔다.' },
        },
      ],
    },
  ],
};
