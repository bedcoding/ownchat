import Link from 'next/link';
import { isAdminBuild } from '@/lib/profile';

export default function Home() {
  return (
    <div className="frame">
      <div className="home">
        <h1>회차 진행형 채팅 게임</h1>
        <p className="sub">
          웹툰 한 회차를 선택지 트리 한 편으로. 목표를 달성하면 다음 화로 넘어갑니다.
          <br />
          트리는 관리자가 미리 만들어 검수해 둡니다. 대부분의 작품은 플레이 중 AI가 돌지 않습니다.
        </p>

        <Link className="link-card" href="/play">
          <div className="t">플레이</div>
          <div className="d">발행된 트리를 플레이합니다</div>
        </Link>

        <Link className="link-card" href="/chat">
          <div className="t">AI 자유 채팅</div>
          <div className="d">
            {isAdminBuild ? '로컬 Claude로 대화하고 작품 아이디어를 시험합니다' : 'OpenAI 데모 서버로 자유롭게 대화합니다'}
          </div>
        </Link>

        <Link className="link-card" href="/tour">
          <div className="t">제품 둘러보기</div>
          <div className="d">실제 플레이 화면 위에서 주요 기능을 확인합니다</div>
        </Link>

        {/*
          관리자 빌드에만 링크가 있고, 사용자 빌드에는 /admin 라우트 자체가 없다
          (next.config.mjs 의 pageExtensions 로 페이지에서 제외된다).
        */}
        {isAdminBuild ? (
          <Link className="link-card" href="/admin">
            <div className="t">관리자 저작 도구</div>
            <div className="d">설정 한 줄에서 트리 초안을 만들고, 고쳐서 발행합니다</div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
