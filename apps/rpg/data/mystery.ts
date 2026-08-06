import { sealBrief } from '@/lib/seal';
import type { Work } from '@/lib/types';

/**
 * 밀실 추리 샘플 — **자작 가상 작품**. 실존 작품이 아니다.
 *
 * 이 샘플이 증명해야 하는 것 (다른 두 샘플과 겹치지 않는 부분만):
 *   1) **추리 문법이 이 엔진에 그대로 얹힌다** — 단서=아이템, 알아낸 사실=플래그,
 *      최종 지목=`requires` 게이트. 엔진 수정 없이 표현된다
 *   2) **확률 분기** — "때린다 / 30% 확률로 실패" 형태의 선택지 (`outcomes`)
 *   3) **심문 노드** — 플레이 중 AI 가 도는 유일한 자리. 이 작품만 "심문 있음" 으로 분류된다
 *   4) 진상이 발행 JSON 안에서 봉인된다 (`sealBrief`)
 *
 * 심문을 하지 않아도 완주할 수 있게 설계했다 — AI 를 못 쓰는 기기에서 작품이 막히면 안 된다.
 * 집사 심문으로 얻는 `필적확인` 은 2화의 서랍 조사로도 얻을 수 있다.
 */
export const MYSTERY_WORK: Work = {
  id: 'snowlodge',
  title: '눈에 갇힌 산장',
  rating: 'all',
  stats: { 관찰: 1, 화술: 1, 담력: 1 },
  characters: [
    { id: 'butler', name: '한씨', intro: '30년을 이 산장에서 일한 관리인. 주인을 감싼다.' },
    { id: 'niece', name: '유진', intro: '주인의 조카. 유산 상속 순위 1번.' },
    { id: 'doctor', name: '오 선생', intro: '눈 때문에 발이 묶인 의사. 사망 시각을 추정했다.' },
  ],
  episodes: [
    // ── 1화. 현장 ────────────────────────────────────────────
    {
      id: 'ep1',
      index: 1,
      title: '1화. 잠긴 서재',
      entry: 'm1_start',
      nodes: [
        {
          id: 'm1_start',
          text: '폭설로 길이 끊긴 밤, 산장 주인이 서재에서 숨진 채 발견됐다.\n문은 안에서 잠겨 있었고 열쇠는 책상 위에 있었다.\n아침까지 눈이 그치지 않는다. 그때까지 이 안에 범인이 있다.',
          reveals: ['doctor'],
          choices: [
            { label: '시신을 살핀다', next: 'm1_body' },
            { label: '방 안을 둘러본다', next: 'm1_room' },
          ],
        },

        {
          id: 'm1_body',
          speaker: '오 선생',
          text: '"뒤통수를 맞았습니다. 넘어져서 생긴 상처가 아니에요."\n오 선생이 손목시계를 가리킨다. 유리가 깨져 9시 40분에 멈춰 있다.',
          choices: [
            {
              label: '멈춘 시계를 챙긴다',
              next: 'm1_room',
              effects: { items: ['멈춘 시계'], stats: { 관찰: 1 } },
            },
            { label: '시각을 의심한다', next: 'm1_doubt', requires: { stats: { 관찰: 2 } }, lockedHint: '아직 이상한 점을 짚어낼 만큼 보지 못했다' },
          ],
        },

        {
          id: 'm1_doubt',
          text: '시계가 멈춘 시각과 시신의 상태가 맞지 않는다. 누군가 시각을 만들어 놓았다.',
          choices: [
            {
              label: '기록해 둔다',
              next: 'm1_room',
              effects: { flags: ['시각조작'], stats: { 관찰: 1 } },
            },
          ],
        },

        {
          id: 'm1_room',
          text: '서재는 좁다. 벽난로에 재가 남아 있고, 창문은 안쪽에서 걸쇠가 걸려 있다.\n책상 밑에 종이 한 장이 반쯤 찢긴 채 떨어져 있다.',
          choices: [
            { label: '찢긴 종이를 줍는다', next: 'm1_note', effects: { items: ['찢긴 메모'] } },
            { label: '벽난로를 뒤진다', next: 'm1_ash' },
            {
              label: '창문 걸쇠를 억지로 흔든다',
              next: 'm1_window',
              // 확률 분기: 확정 대가 없이 운으로만 갈린다
              outcomes: [
                { chance: 35, text: '걸쇠가 부러지며 손을 베었다', effects: { stats: { 담력: -1 } } },
              ],
            },
          ],
        },

        {
          id: 'm1_note',
          text: '"…약속한 몫은 지키겠다. 다만 오늘 밤은—" 뒷부분이 찢겨 나갔다.\n글씨는 주인의 것이 아니다.',
          choices: [{ label: '방을 더 살핀다', next: 'm1_ash' }],
        },

        {
          id: 'm1_ash',
          text: '재 속에 타지 않은 종이 끝이 남아 있다. 같은 종이의 나머지 반쪽이다.\n하지만 글씨는 거의 지워졌다.',
          choices: [
            {
              label: '조각을 챙긴다',
              next: 'm1_end',
              effects: { items: ['탄 종이 조각'], stats: { 관찰: 1 } },
            },
            { label: '그냥 나간다', next: 'm1_end' },
          ],
        },

        {
          id: 'm1_window',
          text: '걸쇠는 안에서만 걸린다. 밖에서 잠글 방법은 없다.\n이 방은 정말로 밀실이었다.',
          choices: [
            { label: '기록해 둔다', next: 'm1_end', effects: { flags: ['밀실확인'] } },
          ],
        },

        {
          id: 'm1_end',
          text: '',
          ending: {
            kind: 'advance',
            title: '첫 밤이 지났다',
            text: '아침이 와도 눈은 그치지 않았다. 이 안의 누군가에게 물어야 한다.',
          },
          choices: [],
        },
      ],
    },

    // ── 2화. 심문과 지목 ─────────────────────────────────────
    {
      id: 'ep2',
      index: 2,
      title: '2화. 세 사람',
      entry: 'm2_start',
      recap: '서재는 밀실이었고, 찢긴 메모는 주인의 글씨가 아니었다.',
      nodes: [
        {
          id: 'm2_start',
          text: '거실에 세 사람이 앉아 있다. 관리인 한씨, 조카 유진, 그리고 오 선생.\n눈이 그칠 때까지 시간은 있다. 하지만 무한하지는 않다.',
          reveals: ['butler', 'niece'],
          choices: [
            { label: '한씨에게 다가간다', next: 'm2_butler' },
            { label: '유진에게 다가간다', next: 'm2_niece' },
            { label: '주인의 방 서랍을 뒤진다', next: 'm2_drawer' },
            // 지목은 requires 게이트 — 단서가 모여야 열린다. 이게 추리 장르의 문법 그 자체다.
            {
              label: '한씨를 지목한다',
              next: 'm2_accuse_butler',
              requires: { flags: ['필적확인', '동기파악'], items: ['찢긴 메모'] },
              lockedHint: '아직 그를 지목할 근거가 모이지 않았다',
            },
            {
              label: '유진을 지목한다',
              next: 'm2_accuse_wrong',
              requires: { flags: ['동기파악'] },
              lockedHint: '동기를 알아내야 한다',
            },
            { label: '지목하지 않고 아침을 기다린다', next: 'm2_wait' },
          ],
        },

        /*
         * 심문 노드. 이 노드 하나 때문에 이 작품이 "심문 있음" 으로 분류된다.
         * 여기서 얻는 `필적확인` 은 m2_drawer 로도 얻을 수 있다 — AI 를 못 쓰는 기기에서
         * 작품이 막히지 않게 하는 우회로다.
         */
        {
          id: 'm2_butler',
          probe: {
            who: '한씨',
            intro: '한씨는 두 손을 무릎에 모으고 앉아 있다. 무엇이든 물어볼 수 있다.',
            maxTurns: 6,
            sealed: sealBrief({
              persona:
                '30년을 이 산장에서 일한 관리인. 예의는 깍듯하지만 주인 가족을 감싸려 한다. 자기 알리바이에 거짓이 섞여 있어서, 그 시각 이야기가 나오면 말을 흐린다. 추궁받으면 불편해하며 화제를 돌린다.',
              knows: [
                '9시쯤 서재 불이 꺼져 있었다',
                '유진이 그날 저녁 주인과 크게 다퉜다',
                '주인은 최근 유언장을 고쳤다',
                '자신은 9시 반부터 주방에 있었다고 말한다',
                '메모지는 산장 응접실에 있는 것과 같은 종류다',
              ],
              withholds: [
                '자신이 고쳐진 유언장을 미리 읽었다는 사실',
                '누가 범인인지에 대한 자신의 짐작',
              ],
              unlocks: [
                {
                  when: ['유언장', '유언'],
                  effects: { flags: ['동기파악'], stats: { 화술: 1 } },
                  notice: '유언장이 최근 고쳐졌다는 걸 알아냈다',
                },
                {
                  when: ['메모지', '응접실', '같은 종류'],
                  effects: { flags: ['필적확인'] },
                  notice: '메모지의 출처를 알아냈다',
                },
              ],
            }),
          },
          text: '한씨는 묻는 말에만 답한다. 캐물어야 나올 이야기가 있다.',
          choices: [
            { label: '자리에서 일어난다', next: 'm2_start' },
            {
              label: '한씨를 추궁한다',
              next: 'm2_press',
              requires: { stats: { 화술: 2 } },
              lockedHint: '아직 그를 몰아세울 말을 찾지 못했다',
            },
          ],
        },

        {
          id: 'm2_press',
          speaker: '한씨',
          text: '"…9시 반이라고 했지요. 그건 제 기억입니다."\n그가 처음으로 눈을 피한다.',
          choices: [
            {
              label: '알리바이를 기록한다',
              next: 'm2_start',
              effects: { flags: ['알리바이깨짐'], stats: { 관찰: 1 } },
            },
          ],
        },

        {
          id: 'm2_niece',
          speaker: '유진',
          text: '"삼촌이 저를 뺐다는 건 알아요. 그래서 다퉜고요."\n숨기지 않는다. 그게 오히려 낯설다.',
          choices: [
            { label: '왜 숨기지 않는지 묻는다', next: 'm2_niece2', effects: { stats: { 화술: 1 } } },
            { label: '자리에서 일어난다', next: 'm2_start' },
          ],
        },

        {
          id: 'm2_niece2',
          speaker: '유진',
          text: '"고쳐진 유언장은 아직 서명이 없어요. 어젯밤 죽었으면 저한테 유리하죠."\n그리고 덧붙인다. "그러니까 제가 아니라는 뜻이에요."',
          choices: [
            {
              label: '기록해 둔다',
              next: 'm2_start',
              effects: { flags: ['동기파악'] },
            },
          ],
        },

        {
          id: 'm2_drawer',
          text: '주인의 방 서랍에 응접실 메모지 묶음이 있다. 찢긴 메모와 같은 종이다.\n그 아래 장부가 있다. 한씨에게 매달 나간 돈이 적혀 있다.',
          choices: [
            {
              label: '장부를 챙긴다',
              next: 'm2_start',
              effects: { items: ['장부'], flags: ['필적확인'], stats: { 관찰: 1 } },
            },
            { label: '덮어 둔다', next: 'm2_start' },
          ],
        },

        {
          id: 'm2_accuse_butler',
          text: '',
          ending: {
            kind: 'final',
            title: '눈이 그쳤다',
            text: '한씨는 오래 앉아 있다가 고개를 끄덕였다.\n"매달 받던 돈이 끊긴다고 하더군요. 30년입니다."\n시각을 만든 것도, 문을 잠근 것도 그였다.',
          },
          choices: [],
        },

        {
          id: 'm2_accuse_wrong',
          text: '',
          ending: {
            kind: 'fail',
            title: '틀린 지목',
            text: '유진은 아무 말도 하지 않았다.\n눈이 그치고 경찰이 왔을 때, 물어야 했던 사람은 이미 산을 내려갔다.',
          },
          choices: [],
        },

        {
          id: 'm2_wait',
          text: '',
          ending: {
            kind: 'fail',
            title: '아무도 지목하지 못했다',
            text: '눈이 그쳤다. 세 사람은 각자 산을 내려갔고, 서재의 문은 다시 잠겼다.',
          },
          choices: [],
        },
      ],
    },
  ],
};
