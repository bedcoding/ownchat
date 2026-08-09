'use client';

import { useEffect, useState } from 'react';
import { TOUR_FALLBACK } from '@/data/tour-fallback';
import { isHostedBuild } from '@/lib/profile';
import { isTourDocument, type TourDocument } from '@/lib/tour';
import Runner from '../play/Runner';
import WorkLibrary from '../play/WorkLibrary';
import TourOverlay from './TourOverlay';
import { TOUR_STEPS } from './steps';

interface TourApiResponse {
  tour?: unknown;
  revision?: unknown;
}

interface LoadedTour {
  document: TourDocument;
  revision: number;
}

const FALLBACK_TOUR: LoadedTour = { document: TOUR_FALLBACK, revision: 0 };

export default function TourPage() {
  const [index, setIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<LoadedTour | null>(null);

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('tstep'));
    setIndex(
      Number.isInteger(requested) && requested >= 1 && requested <= TOUR_STEPS.length
        ? requested - 1
        : 0,
    );
  }, []);

  useEffect(() => {
    if (!isHostedBuild) {
      setLoaded(FALLBACK_TOUR);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_500);

    void fetch('/api/tour', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`tour request failed (${response.status})`);
        const payload = (await response.json()) as TourApiResponse;
        if (!isTourDocument(payload.tour)) throw new Error('invalid tour document');
        return {
          document: payload.tour,
          revision:
            typeof payload.revision === 'number' && Number.isInteger(payload.revision)
              ? payload.revision
              : 0,
        };
      })
      .then((tour) => {
        if (active) setLoaded(tour);
      })
      .catch(() => {
        if (active) setLoaded(FALLBACK_TOUR);
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!loaded) {
    return (
      <main className="tour-page">
        <div className="frame" aria-busy="true">
          <div className="empty-note">둘러보기를 준비하는 중…</div>
        </div>
      </main>
    );
  }

  const currentIndex = index ?? 0;
  const step = TOUR_STEPS[currentIndex];
  const screen = step.screen;
  const tour = loaded.document;
  const runnerState = screen === 'probe' ? tour.probeState : tour.sceneState;
  const initialTab = screen === 'dex' ? ('dex' as const) : ('scene' as const);
  const runnerKey = `${loaded.revision}-${tour.work.id}-${screen}-${initialTab}`;

  return (
    <main className="tour-page">
      {screen === 'library' ? (
        <WorkLibrary
          works={[tour.work]}
          onSelect={() => setIndex(2)}
          backHref="/"
          tourMode
        />
      ) : (
        <Runner
          key={runnerKey}
          work={tour.work}
          initial={runnerState}
          initialTab={initialTab}
          onExit={() => setIndex(1)}
          tourMode
          demoProbe={screen === 'probe' ? tour.probeDemo : undefined}
        />
      )}

      {index !== null ? (
        <TourOverlay steps={TOUR_STEPS} index={index} onIndexChange={setIndex} />
      ) : null}
    </main>
  );
}
