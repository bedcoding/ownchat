'use client';

import Link from 'next/link';
import { brand } from '@/lib/brand';
import { requiresRuntimeAI } from '@/lib/engine';
import type { PlayState, Work } from '@/lib/types';

interface Props {
  works: Work[];
  saved?: PlayState | null;
  onSelect: (workId: string) => void;
  onClear?: () => void;
  backHref?: string;
  tourMode?: boolean;
}

/** 일반 플레이와 제품 투어가 함께 쓰는 실제 작품 선택 화면. */
export default function WorkLibrary({
  works,
  saved = null,
  onSelect,
  onClear,
  backHref = '/',
  tourMode = false,
}: Props) {
  return (
    <div className="frame" data-tour={tourMode ? 'library' : undefined}>
      <div className="topbar">
        <Link className="icon-btn" href={backHref} aria-label="처음 화면으로">
          ←
        </Link>
        <span className="title">작품 선택</span>
      </div>

      <div className="panel">
        {works.length === 0 ? (
          <div className="empty-note">
            발행된 작품이 없습니다.
            <br />
            관리자 화면에서 트리를 만들어 발행하세요.
          </div>
        ) : (
          works.map((work, index) => {
            const resume = saved?.workId === work.id;
            const needsAi = requiresRuntimeAI(work);

            return (
              <button
                key={work.id}
                className="link-card"
                data-tour={tourMode && index === 0 ? 'work-card' : undefined}
                onClick={() => onSelect(work.id)}
              >
                <div className="t">
                  {brand(work.title)}
                  <span className={`tagline ${needsAi ? 'ai' : 'offline'}`}>
                    {needsAi ? '자유 심문 포함' : 'AI 비용 없음'}
                  </span>
                </div>
                <div className="d">
                  {work.episodes.length}화 수록 · 등장인물 {work.characters.length}명
                  {work.rating === 'adult' ? ' · 성인' : ''}
                  {resume ? ` · ${saved.episodeIndex}화부터 이어하기` : ''}
                </div>
              </button>
            );
          })
        )}

        {saved && onClear ? (
          <button className="btn" style={{ marginTop: 8 }} onClick={onClear}>
            진행 기록 지우기
          </button>
        ) : null}
      </div>
    </div>
  );
}
