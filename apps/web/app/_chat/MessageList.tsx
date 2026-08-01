'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/lib/types';

interface Props {
  messages: Message[];
  showThinking: boolean;
}

export default function MessageList({ messages, showThinking }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  // 스트리밍 중에는 새 글자가 붙을 때마다 바닥을 따라간다.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, last?.text]);

  return (
    <div className="thread">
      {messages.map((msg) => (
        <article className={`msg ${msg.role}`} key={msg.id}>
          <div className="msg-role">{msg.role === 'user' ? '나' : 'Claude'}</div>

          {showThinking && msg.thinking ? <div className="thinking">{msg.thinking}</div> : null}

          {msg.error ? (
            <div className="msg-error">
              <strong>{msg.error.message}</strong>
              {msg.error.hint ? <span>{msg.error.hint}</span> : null}
            </div>
          ) : (
            <div className="msg-body">
              {/* 사용자·모델 텍스트는 전부 텍스트 노드로만 렌더한다. HTML로 해석되는 경로를 두지 않는다. */}
              {msg.text}
              {msg.streaming ? <span className="caret" aria-label="응답 중" /> : null}
            </div>
          )}
        </article>
      ))}
      <div ref={endRef} />
    </div>
  );
}
