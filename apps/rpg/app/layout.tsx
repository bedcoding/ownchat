import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '회차 진행형 채팅 게임',
  description: '웹툰 회차를 선택지 트리로. 미리 만들어 두고, 플레이 중에는 AI를 쓰지 않습니다',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
