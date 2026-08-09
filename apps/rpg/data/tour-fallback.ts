import { sealBrief } from '@/lib/seal';
import type { TourDocument } from '@/lib/tour';
import type { Work } from '@/lib/types';

/**
 * DB가 비었거나 연결되지 않을 때만 사용하는 완전한 가상 작품.
 * 회사·플랫폼·실제 프로젝트를 연상시키는 고유명사를 넣지 않는다.
 */
const FALLBACK_WORK: Work = {
  id: 'tour-fallback-library',
  title: '도서관의 마지막 열쇠',
  rating: 'all',
  stats: { 관찰: 2, 대화: 1, 집중: 1 },
  characters: [
    { id: 'librarian', name: '안내원', intro: '폐관 시간까지 안내 데스크를 지키고 있었다.' },
    { id: 'visitor', name: '방문자', intro: '마지막 열람실을 이용한 방문자.' },
    { id: 'keeper', name: '사서', intro: '자료 보관실을 관리한다.' },
  ],
  episodes: [
    {
      id: 'library-ep1',
      index: 1,
      title: '1화. 사라진 열쇠',
      entry: 'reading-room',
      nodes: [
        {
          id: 'reading-room',
          text: '폐관을 앞둔 도서관에서 자료 보관실 열쇠가 사라졌다.\n열람실에는 반납함과 대출 기록표만 남아 있다.',
          reveals: ['librarian'],
          choices: [
            {
              label: '대출 기록표를 확인한다',
              next: 'records',
              effects: { items: ['대출 기록표'], stats: { 관찰: 1 } },
            },
            { label: '안내원에게 물어본다', next: 'ask-librarian' },
            {
              label: '잠긴 보관함을 연다',
              next: 'found',
              requires: { items: ['작은 열쇠'] },
              lockedHint: '보관함을 열 열쇠가 필요하다',
            },
          ],
        },
        {
          id: 'records',
          text: '기록표 마지막 줄에 반납함을 점검했다는 메모가 있다.',
          choices: [
            { label: '반납함을 살펴본다', next: 'found', effects: { items: ['작은 열쇠'] } },
            { label: '안내원에게 물어본다', next: 'ask-librarian' },
          ],
        },
        {
          id: 'ask-librarian',
          speaker: '안내원',
          text: '안내원은 기억나는 범위에서 질문에 답하겠다고 한다.',
          probe: {
            who: '안내원',
            intro: '폐관 전 상황을 자유롭게 물어볼 수 있다.',
            maxTurns: 5,
            sealed: sealBrief({
              persona: '차분하고 친절한 도서관 안내원. 확인되지 않은 내용은 추측하지 않는다.',
              knows: [
                '마지막으로 반납함을 점검했다',
                '열쇠가 작은 책갈피 상자에 섞였을 가능성이 있다',
                '방문자는 폐관 안내를 듣고 바로 나갔다',
              ],
              unlocks: [
                {
                  when: ['반납함', '책갈피 상자'],
                  effects: { flags: ['반납함확인'], stats: { 대화: 1 } },
                  notice: '반납함을 다시 확인할 이유를 찾았다',
                },
              ],
            }),
          },
          choices: [
            { label: '열람실로 돌아간다', next: 'reading-room' },
            {
              label: '반납함을 확인한다',
              next: 'found',
              requires: { flags: ['반납함확인'] },
              lockedHint: '확인할 만한 단서가 더 필요하다',
            },
          ],
        },
        {
          id: 'found',
          text: '',
          ending: {
            kind: 'final',
            title: '제자리로',
            text: '열쇠는 책갈피 상자 아래에서 발견됐다. 보관실 문이 다시 열린다.',
          },
          choices: [],
        },
      ],
    },
  ],
};

export const TOUR_FALLBACK: TourDocument = {
  work: FALLBACK_WORK,
  sceneState: {
    workId: FALLBACK_WORK.id,
    episodeIndex: 1,
    nodeId: 'reading-room',
    stats: { 관찰: 2, 대화: 1, 집중: 1 },
    flags: [],
    items: ['도서관 안내도'],
    revealed: ['librarian'],
    log: [
      {
        episodeIndex: 1,
        nodeId: 'reading-room',
        text: '폐관을 앞둔 도서관에서 자료 보관실 열쇠가 사라졌다.',
      },
    ],
    endings: [],
  },
  probeState: {
    workId: FALLBACK_WORK.id,
    episodeIndex: 1,
    nodeId: 'ask-librarian',
    stats: { 관찰: 3, 대화: 2, 집중: 1 },
    flags: ['반납함확인'],
    items: ['도서관 안내도', '대출 기록표'],
    revealed: ['librarian', 'visitor'],
    log: [
      {
        episodeIndex: 1,
        nodeId: 'reading-room',
        text: '자료 보관실 열쇠가 사라졌다.',
        choice: '안내원에게 물어본다',
      },
    ],
    endings: [],
    probeTurns: { 'ask-librarian': 1 },
    probeUnlocked: ['ask-librarian:0'],
  },
  probeDemo: {
    log: [
      { role: 'user', text: '폐관 전에 반납함을 확인했나요?' },
      {
        role: 'assistant',
        text: '네. 책과 책갈피 상자를 함께 꺼냈습니다. 작은 물건이 섞였다면 그 안에 있을 수 있어요.',
        gains: ['반납함을 다시 확인할 이유를 찾았다'],
      },
    ],
    reply: '마지막 방문자는 안내 방송 뒤 바로 나갔습니다. 반납함과 책갈피 상자를 먼저 확인해 보세요.',
  },
};
