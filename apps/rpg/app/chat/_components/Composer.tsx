'use client';

import { useRef, useState } from 'react';

interface Props {
  disabled: boolean;
  sending: boolean;
  placeholder: string;
  hint: string;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function Composer({ disabled, sending, placeholder, hint, onSend, onStop }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || sending) return;
    onSend(text);
    setValue('');
    requestAnimationFrame(grow);
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <div className="composer-box">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              // Enter는 전송, Shift+Enter는 줄바꿈. 한글 조합 중(isComposing)에는 가로채지 않는다 —
              // 그러지 않으면 조합이 끝나기 전에 전송돼 마지막 글자가 잘린다.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {sending ? (
            <button type="button" className="btn" onClick={onStop}>
              중단
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={submit} disabled={disabled || !value.trim()}>
              보내기
            </button>
          )}
        </div>
        <p className="composer-hint">
          <span>{hint}</span>
          <span>· Enter 전송 / Shift+Enter 줄바꿈</span>
        </p>
      </div>
    </div>
  );
}
