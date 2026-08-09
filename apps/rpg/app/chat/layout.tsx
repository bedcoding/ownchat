import type { Metadata } from 'next';
import './chat.css';

export const metadata: Metadata = {
  title: 'AI 자유 채팅 · ownchat',
  description: '설치형에서는 로컬 Claude를, 공개 웹에서는 서버의 OpenAI API를 사용하는 채팅 화면',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
