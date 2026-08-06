'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { brand } from '@/lib/brand';
import { requiresRuntimeAI } from '@/lib/engine';
import { loadPlay, loadPlayableWorks, savePlay } from '@/lib/storage';
import type { PlayState, Work } from '@/lib/types';
import Runner from './Runner';

export default function PlayPage() {
  const [hydrated, setHydrated] = useState(false);
  const [works, setWorks] = useState<Work[]>([]);
  const [saved, setSaved] = useState<PlayState | null>(null);
  const [workId, setWorkId] = useState<string | null>(null);

  // localStorage 는 서버 렌더에 없다. 마운트 후에 읽는다.
  useEffect(() => {
    const list = loadPlayableWorks();
    const play = loadPlay();
    setWorks(list);
    setSaved(play);
    // 이어할 기록이 있고 그 작품이 아직 있으면 바로 이어서
    if (play && list.some((w) => w.id === play.workId)) setWorkId(play.workId);
    setHydrated(true);
  }, []);

  const persist = useCallback((state: PlayState | null) => {
    savePlay(state);
  }, []);

  const exit = useCallback(() => {
    setSaved(loadPlay());
    setWorkId(null);
  }, []);

  if (!hydrated) return <div className="frame" aria-busy="true" />;

  const work = workId ? works.find((w) => w.id === workId) : undefined;
  if (work) {
    return (
      <Runner
        work={work}
        initial={saved && saved.workId === work.id ? saved : null}
        persist={persist}
        onExit={exit}
      />
    );
  }

  return (
    <div className="frame">
      <div className="topbar">
        <Link className="icon-btn" href="/">
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
          works.map((w) => {
            const resume = saved && saved.workId === w.id;
            /*
             * 작품 데이터가 정한다 — 심문 노드를 하나도 쓰지 않은 작품은 오프라인에서 돌고
             * 아무 비용도 들지 않는다. 들어가기 전에 알 수 있어야 한다.
             */
            const needsAi = requiresRuntimeAI(w);
            return (
              <button
                key={w.id}
                className="link-card"
                onClick={() => {
                  setWorkId(w.id);
                }}
              >
                <div className="t">
                  {brand(w.title)}
                  <span className={`tagline ${needsAi ? 'ai' : 'offline'}`}>
                    {needsAi ? '심문 있음' : '오프라인'}
                  </span>
                </div>
                <div className="d">
                  {w.episodes.length}화 수록 · 등장인물 {w.characters.length}명
                  {w.rating === 'adult' ? ' · 성인' : ''}
                  {resume ? ` · ${saved!.episodeIndex}화부터 이어하기` : ''}
                </div>
              </button>
            );
          })
        )}

        {saved ? (
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => {
              savePlay(null);
              setSaved(null);
            }}
          >
            진행 기록 지우기
          </button>
        ) : null}
      </div>
    </div>
  );
}
