import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ownchat · 인터랙티브 스토리',
  description: '버튼형 스토리와 AI 자유 채팅을 한 앱에서 만드는 인터랙티브 콘텐츠 도구',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
