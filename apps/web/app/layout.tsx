import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ownchat',
  description: '내 계정으로 쓰는 AI 채팅 — 추론 비용이 서비스가 아니라 사용자 쪽에서 발생합니다',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
