import type { ReactNode } from 'react';

export type TourScreen = 'library' | 'scene' | 'dex' | 'probe';

export interface TourStep {
  screen: TourScreen;
  target?: string;
  title: string;
  body: ReactNode;
  placement?: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * 제품 설명과 강조 대상의 단일 목록.
 * `?tstep=N`과 같은 순서를 사용하므로 나중에 PDF 자동 캡처에도 그대로 쓸 수 있다.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    screen: 'library',
    title: '선택지 이야기와 자유 추리를 한 작품 안에서',
    body: (
      <>
        <p>
          작가는 이야기를 미리 만들고 검수합니다. 독자는 <strong>버튼으로 안정적으로 진행</strong>하다가,
          필요한 장면에서만 인물에게 직접 질문할 수 있습니다.
        </p>
        <ul>
          <li>일반 장면은 AI 호출 없이 즉시 진행</li>
          <li>자유 심문 장면에서만 모델 API 사용</li>
          <li>단서·상태·엔딩 판정은 게임 엔진이 담당</li>
        </ul>
      </>
    ),
  },
  {
    screen: 'library',
    target: 'work-card',
    title: '들어가기 전에 플레이 방식을 알 수 있습니다',
    body: (
      <p>
        작품 카드에 회차와 등장인물 수, 자유 심문 포함 여부를 표시합니다. 이 투어는 DB가 비어 있어도
        열리도록 <strong>검증된 예시 작품</strong>을 사용합니다.
      </p>
    ),
    placement: 'right',
  },
  {
    screen: 'scene',
    target: 'scene',
    title: '실제 플레이 화면을 그대로 보여줍니다',
    body: (
      <p>
        별도의 발표용 모형이 아닙니다. 사용자와 관리자 미리보기가 함께 쓰는 동일한 러너가 장면, 대사,
        이미지와 회차를 렌더링합니다.
      </p>
    ),
    placement: 'right',
  },
  {
    screen: 'scene',
    target: 'choices',
    title: '대부분의 진행은 비용이 들지 않습니다',
    body: (
      <p>
        미리 생성하고 검수한 선택지를 누르면 로컬 게임 엔진이 다음 장면과 상태 변화를 계산합니다.
        조건이 부족한 선택지도 숨기지 않아 <strong>재도전할 이유</strong>를 남깁니다.
      </p>
    ),
    placement: 'right',
  },
  {
    screen: 'scene',
    target: 'hud',
    title: '선택의 결과는 상태로 누적됩니다',
    body: (
      <p>
        관찰·화술 같은 능력치와 획득한 단서가 다음 선택지를 엽니다. 모델은 아이템이나 정답을 임의로
        지급하지 않고, <strong>게임 규칙이 결과를 확정</strong>합니다.
      </p>
    ),
    placement: 'right',
  },
  {
    screen: 'dex',
    target: 'dex',
    title: '만난 인물과 수사 기록을 다시 확인합니다',
    body: (
      <p>
        도감과 기록은 플레이 중 해금된 정보만 보여줍니다. 독자는 대화를 기억에만 의존하지 않고 단서를
        비교하며 추리를 이어갈 수 있습니다.
      </p>
    ),
    placement: 'right',
  },
  {
    screen: 'probe',
    target: 'probe',
    title: '자유 심문 장면에서만 AI를 호출합니다',
    body: (
      <>
        <p>
          정해진 질문 버튼 대신 등장인물에게 직접 물어볼 수 있습니다. 공개 웹에서는 이 구간만 모델 API와
          연결하고, 나머지 장면에는 토큰 비용이 발생하지 않습니다.
        </p>
        <p className="tour-note">
          지금 보이는 대화는 안정적인 시연을 위한 예시이며 실제 API를 호출하지 않습니다.
        </p>
      </>
    ),
    placement: 'right',
  },
  {
    screen: 'probe',
    title: '설명 뒤에도 그대로 플레이할 수 있습니다',
    body: (
      <>
        <p>
          둘러보기를 닫으면 지금 보던 실제 화면이 남습니다. 심사위원은 슬라이드를 넘기는 대신 선택지를
          누르고 질문을 입력해 제품 흐름을 직접 확인할 수 있습니다.
        </p>
        <p className="tour-note">화살표 키로 이동하고, Esc로 언제든 투어를 닫을 수 있습니다.</p>
      </>
    ),
  },
];
