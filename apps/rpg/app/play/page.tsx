'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadPlay, loadPlayableWorksForCurrentBuild, savePlay } from '@/lib/storage';
import type { PlayState, Work } from '@/lib/types';
import Runner from './Runner';
import WorkLibrary from './WorkLibrary';

export default function PlayPage() {
  const [hydrated, setHydrated] = useState(false);
  const [works, setWorks] = useState<Work[]>([]);
  const [saved, setSaved] = useState<PlayState | null>(null);
  const [workId, setWorkId] = useState<string | null>(null);

  // localStorage 는 서버 렌더에 없다. 마운트 후에 읽는다.
  useEffect(() => {
    let active = true;
    void loadPlayableWorksForCurrentBuild().then((list) => {
      if (!active) return;
      const play = loadPlay();
      setWorks(list);
      setSaved(play);
      if (play && list.some((work) => work.id === play.workId)) setWorkId(play.workId);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((state: PlayState | null) => {
    savePlay(state);
  }, []);

  const exit = useCallback(() => {
    setSaved(loadPlay());
    setWorkId(null);
  }, []);

  if (!hydrated) return <div className="frame" aria-busy="true" />;

  const work = workId ? works.find((candidate) => candidate.id === workId) : undefined;
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
    <WorkLibrary
      works={works}
      saved={saved}
      onSelect={setWorkId}
      onClear={() => {
        savePlay(null);
        setSaved(null);
      }}
    />
  );
}
