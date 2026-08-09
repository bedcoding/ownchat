'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TourStep } from './steps';
import './tour.css';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  steps: TourStep[];
  index: number;
  onIndexChange: (index: number) => void;
}

const PAD = 8;
const GAP = 14;
// 1280px 발표 화면에서도 가운데의 560px 플레이어 옆에 카드가 놓일 수 있는 너비.
const CARD_WIDTH = 320;
const BOTTOM_RESERVED = 84;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** 실제 DOM의 위치를 따라다니는 제품 투어 오버레이. */
export default function TourOverlay({ steps, index, onIndexChange }: Props) {
  const [done, setDone] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef(-1);
  const step = steps[index];

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }

    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!target) {
      setRect(null);
      return;
    }

    const box = target.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const left = clamp(box.left - PAD, GAP, width - GAP);
    const right = clamp(box.right + PAD, left, width - GAP);
    const top = clamp(box.top - PAD, GAP, height - GAP);
    const bottom = clamp(box.bottom + PAD, top, height - GAP);

    setRect({ left, top, width: right - left, height: bottom - top });
  }, [step]);

  useLayoutEffect(() => {
    setCardHeight(cardRef.current?.offsetHeight ?? 220);
  }, [index, rect]);

  useLayoutEffect(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }

    let mobileOffsetTimer: number | undefined;
    const locate = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (target && scrolledFor.current !== index) {
        scrolledFor.current = index;
        const narrow = window.innerWidth <= 640;
        target.scrollIntoView({ block: narrow ? 'end' : 'center', behavior: 'smooth' });
        // 모바일은 설명 카드를 옆에 둘 수 없다. 대상을 아래로 보내 카드가 놓일 위 공간을 만든다.
        if (narrow) {
          mobileOffsetTimer = window.setTimeout(() => {
            window.scrollBy({ top: BOTTOM_RESERVED, behavior: 'smooth' });
          }, 180);
        }
      }
      measure();
    };

    locate();
    const timers = [100, 280, 600].map((delay) => window.setTimeout(locate, delay));
    return () => {
      timers.forEach(window.clearTimeout);
      if (mobileOffsetTimer) window.clearTimeout(mobileOffsetTimer);
    };
  }, [index, step, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tstep', String(index + 1));
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  const go = useCallback(
    (next: number) => {
      if (next >= steps.length) {
        setDone(true);
        return;
      }
      scrolledFor.current = -1;
      onIndexChange(clamp(next, 0, steps.length - 1));
    },
    [onIndexChange, steps.length],
  );

  useEffect(() => {
    if (done) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      const typing = element?.matches('input, textarea, select, [contenteditable="true"]');

      if (event.key === 'Escape') setDone(true);
      else if (!typing && (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter')) {
        go(index + 1);
      } else if (!typing && event.key === 'ArrowLeft') {
        go(index - 1);
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [done, go, index]);

  if (done) {
    return (
      <button
        className="tour-restart"
        onClick={() => {
          setDone(false);
          scrolledFor.current = -1;
          onIndexChange(0);
        }}
      >
        ↻ 제품 둘러보기
      </button>
    );
  }

  if (!step) return null;

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const cardWidth = Math.min(CARD_WIDTH, viewportWidth - GAP * 2);
  const usableBottom = viewportHeight - BOTTOM_RESERVED;
  const cardMaxTop = Math.max(GAP, usableBottom - Math.min(cardHeight, usableBottom - GAP));
  let cardStyle: React.CSSProperties;

  if (!rect) {
    cardStyle = {
      width: cardWidth,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else {
    const fitsRight = rect.left + rect.width + GAP + cardWidth <= viewportWidth - GAP;
    const fitsLeft = rect.left - GAP - cardWidth >= GAP;
    const fitsBelow = rect.top + rect.height + GAP + cardHeight <= usableBottom;
    const fitsAbove = rect.top - GAP - cardHeight >= GAP;
    let placement = step.placement;

    if (placement === 'right' && !fitsRight) placement = undefined;
    if (placement === 'left' && !fitsLeft) placement = undefined;
    if (placement === 'bottom' && !fitsBelow) placement = undefined;
    if (placement === 'top' && !fitsAbove) placement = undefined;
    placement ??= fitsRight ? 'right' : fitsLeft ? 'left' : fitsBelow ? 'bottom' : 'top';

    const topForSide = clamp(rect.top, GAP, cardMaxTop);
    if (placement === 'right') {
      cardStyle = { width: cardWidth, left: rect.left + rect.width + GAP, top: topForSide };
    } else if (placement === 'left') {
      cardStyle = { width: cardWidth, left: rect.left - GAP - cardWidth, top: topForSide };
    } else if (placement === 'bottom') {
      cardStyle = {
        width: cardWidth,
        left: clamp(rect.left, GAP, viewportWidth - cardWidth - GAP),
        top: clamp(rect.top + rect.height + GAP, GAP, cardMaxTop),
      };
    } else {
      cardStyle = {
        width: cardWidth,
        left: clamp(rect.left, GAP, viewportWidth - cardWidth - GAP),
        top: clamp(rect.top - GAP - cardHeight, GAP, cardMaxTop),
      };
    }
  }

  return (
    <div className="tour-root">
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="tour-scrim" />
      )}

      <div
        ref={cardRef}
        className={`tour-card${rect ? '' : ' center'}`}
        style={cardStyle}
        role="dialog"
        aria-label={`제품 둘러보기 ${index + 1}단계`}
        aria-live="polite"
        tabIndex={-1}
      >
        <div className="tour-step-no">
          {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
        </div>
        <h2>{step.title}</h2>
        <div className="tour-body">{step.body}</div>
        <div className="tour-actions">
          {index > 0 ? (
            <button className="tour-ghost" onClick={() => go(index - 1)}>
              이전
            </button>
          ) : null}
          <button className="tour-primary" onClick={() => go(index + 1)}>
            {index === steps.length - 1 ? '직접 사용해보기' : '다음'}
          </button>
        </div>
      </div>

      <div className="tour-bar" aria-label="둘러보기 단계">
        <button className="tour-ghost" onClick={() => setDone(true)}>
          건너뛰기
        </button>
        <div className="tour-dots">
          {steps.map((candidate, candidateIndex) => (
            <button
              key={candidate.title}
              className={`tour-dot${candidateIndex === index ? ' on' : ''}`}
              aria-label={`${candidateIndex + 1}단계: ${candidate.title}`}
              onClick={() => go(candidateIndex)}
            />
          ))}
        </div>
        <button className="tour-ghost" onClick={() => go(index + 1)}>
          다음 ›
        </button>
      </div>
    </div>
  );
}
