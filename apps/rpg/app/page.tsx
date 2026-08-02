import Link from 'next/link';

export default function Home() {
  return (
    <div className="frame">
      <div className="home">
        <h1>회차 진행형 채팅 게임</h1>
        <p className="sub">
          웹툰 한 회차를 선택지 트리 한 편으로. 목표를 달성하면 다음 화로 넘어갑니다.
          <br />
          플레이 중에는 AI가 돌지 않습니다. 관리자가 미리 만들어 검수해 둔 트리를 걷습니다.
        </p>

        <Link className="link-card" href="/play">
          <div className="t">플레이</div>
          <div className="d">발행된 트리를 플레이합니다 (샘플 작품 3화 수록)</div>
        </Link>

        <Link className="link-card" href="/admin">
          <div className="t">관리자 저작 도구</div>
          <div className="d">회차 이미지에서 트리 초안을 만들고, 고쳐서 발행합니다</div>
        </Link>
      </div>
    </div>
  );
}
