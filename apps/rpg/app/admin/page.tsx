'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SAMPLE_WORK } from '@/data/sample';
import { cloneWork, downloadWork, emptyEpisode, emptyWork, newId, parseWork } from '@/lib/authoring';
import { validateEpisode } from '@/lib/engine';
import { loadPublished, savePublished } from '@/lib/storage';
import type { Episode, Work } from '@/lib/types';
import Runner from '../play/Runner';
import EpisodeEditor from './EpisodeEditor';

type View = { kind: 'list' } | { kind: 'work' } | { kind: 'episode'; id: string } | { kind: 'preview'; index: number };

export default function AdminPage() {
  const [hydrated, setHydrated] = useState(false);
  const [works, setWorks] = useState<Work[]>([]);
  const [draft, setDraft] = useState<Work | null>(null);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWorks(loadPublished());
    setHydrated(true);
  }, []);

  const publish = useCallback(
    (work: Work) => {
      const next = works.some((w) => w.id === work.id)
        ? works.map((w) => (w.id === work.id ? work : w))
        : [...works, work];
      setWorks(next);
      savePublished(next);
      setNotice(`"${work.title}" 발행했습니다. 플레이 화면에서 바로 보입니다.`);
      setTimeout(() => setNotice(null), 3000);
    },
    [works],
  );

  const importFile = useCallback(async (file: File) => {
    const result = parseWork(await file.text());
    if (result.error || !result.work) {
      setNotice(`가져오기 실패: ${result.error}`);
      return;
    }
    setDraft(result.work);
    setView({ kind: 'work' });
    setNotice(`"${result.work.title}" 불러왔습니다. 발행해야 플레이에 반영됩니다.`);
  }, []);

  if (!hydrated) return <div className="admin-wide" aria-busy="true" />;

  // ── 미리보기 ────────────────────────────────────────────
  if (view.kind === 'preview' && draft) {
    // 미리보기는 저장하지 않는다 — 관리자가 눌러본 흔적이 플레이 기록에 남으면 안 된다
    const scoped: Work = { ...draft, episodes: draft.episodes.filter((e) => e.index >= view.index) };
    return <Runner work={scoped} onExit={() => setView({ kind: 'work' })} />;
  }

  // ── 에피소드 편집 ───────────────────────────────────────
  if (view.kind === 'episode' && draft) {
    const episode = draft.episodes.find((e) => e.id === view.id);
    if (episode) {
      return (
        <EpisodeEditor
          work={draft}
          episode={episode}
          onChange={(next) =>
            setDraft({ ...draft, episodes: draft.episodes.map((e) => (e.id === next.id ? next : e)) })
          }
          onBack={() => setView({ kind: 'work' })}
          onPreview={() => setView({ kind: 'preview', index: episode.index })}
        />
      );
    }
  }

  // ── 작품 편집 ───────────────────────────────────────────
  if (view.kind === 'work' && draft) {
    return (
      <WorkEditor
        work={draft}
        onChange={setDraft}
        onBack={() => setView({ kind: 'list' })}
        onOpenEpisode={(id) => setView({ kind: 'episode', id })}
        onPublish={() => publish(draft)}
        onPreview={(index) => setView({ kind: 'preview', index })}
        notice={notice}
      />
    );
  }

  // ── 작품 목록 ───────────────────────────────────────────
  return (
    <div className="admin-wide">
      <div className="admin-bar">
        <Link className="mini" href="/">
          ← 홈
        </Link>
        <strong>저작 도구</strong>
        <span className="spacer" />
        <button
          className="mini"
          onClick={() => {
            setDraft(cloneWork(SAMPLE_WORK, `${SAMPLE_WORK.title} (사본)`));
            setView({ kind: 'work' });
          }}
        >
          샘플 복제
        </button>
        <button className="mini" onClick={() => fileRef.current?.click()}>
          JSON 가져오기
        </button>
        <button
          className="mini primary"
          onClick={() => {
            setDraft(emptyWork());
            setView({ kind: 'work' });
          }}
        >
          + 새 작품
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {notice ? <div className="notice">{notice}</div> : null}

      <div className="admin-body">
        <p className="hint-line">
          여기서 만든 트리는 브라우저에 저장됩니다. 다른 기기로 옮기려면 <b>JSON 내보내기</b>를 쓰세요.
        </p>

        {works.length === 0 ? (
          <p className="hint-line">아직 발행한 작품이 없습니다. 샘플을 복제해 구조를 살펴보세요.</p>
        ) : (
          works.map((w) => (
            <div className="work-row" key={w.id}>
              <button
                className="work-open"
                onClick={() => {
                  setDraft(w);
                  setView({ kind: 'work' });
                }}
              >
                <span className="t">{w.title}</span>
                <span className="d">
                  {w.episodes.length}화 · 인물 {w.characters.length}명 · {w.rating === 'adult' ? '성인' : '전연령'}
                </span>
              </button>
              <button className="mini" onClick={() => downloadWork(w)}>
                내보내기
              </button>
              <button
                className="mini danger"
                onClick={() => {
                  const next = works.filter((x) => x.id !== w.id);
                  setWorks(next);
                  savePublished(next);
                }}
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 작품 편집 화면 ─────────────────────────────────────────

function WorkEditor({
  work,
  onChange,
  onBack,
  onOpenEpisode,
  onPublish,
  onPreview,
  notice,
}: {
  work: Work;
  onChange: (w: Work) => void;
  onBack: () => void;
  onOpenEpisode: (id: string) => void;
  onPublish: () => void;
  onPreview: (index: number) => void;
  notice: string | null;
}) {
  const totalIssues = work.episodes.reduce((sum, e) => sum + validateEpisode(e).filter((i) => i.level === 'error').length, 0);

  const setStat = (oldName: string, name: string, value: number) => {
    const stats: Record<string, number> = {};
    for (const [k, v] of Object.entries(work.stats)) {
      if (k === oldName) {
        if (name) stats[name] = value;
      } else stats[k] = v;
    }
    onChange({ ...work, stats });
  };

  return (
    <div className="admin-wide">
      <div className="admin-bar">
        <button className="mini" onClick={onBack}>
          ← 목록
        </button>
        <strong>{work.title}</strong>
        <span className="spacer" />
        {totalIssues > 0 ? <span className="issue-count bad">오류 {totalIssues}건</span> : null}
        <button className="mini" onClick={() => downloadWork(work)}>
          JSON 내보내기
        </button>
        <button className="mini" onClick={() => onPreview(work.episodes[0]?.index ?? 1)}>
          처음부터 미리보기
        </button>
        <button className="mini primary" onClick={onPublish}>
          발행
        </button>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}

      <div className="admin-body">
        <div className="ep-meta">
          <label className="field inline grow">
            <span>작품 제목</span>
            <input value={work.title} onChange={(e) => onChange({ ...work, title: e.target.value })} />
          </label>
          <label className="field inline">
            <span>등급</span>
            <select
              value={work.rating}
              onChange={(e) => onChange({ ...work, rating: e.target.value as 'all' | 'adult' })}
            >
              <option value="all">전연령</option>
              <option value="adult">성인</option>
            </select>
          </label>
        </div>

        {/* 스탯 */}
        <div className="section">
          <h3>
            능력치
            <button
              className="mini"
              onClick={() => onChange({ ...work, stats: { ...work.stats, [`능력치${Object.keys(work.stats).length + 1}`]: 1 } })}
            >
              + 추가
            </button>
          </h3>
          <div className="row wrap">
            {Object.entries(work.stats).map(([name, value]) => (
              <div className="stat-edit" key={name}>
                <input value={name} onChange={(e) => setStat(name, e.target.value, value)} />
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setStat(name, name, Number(e.target.value))}
                />
                <button className="mini danger" onClick={() => setStat(name, '', 0)}>
                  ×
                </button>
              </div>
            ))}
            {Object.keys(work.stats).length === 0 ? <span className="hint-line">시작 능력치를 정의하세요.</span> : null}
          </div>
        </div>

        {/* 캐릭터 */}
        <div className="section">
          <h3>
            등장인물 <em>(도감)</em>
            <button
              className="mini"
              onClick={() =>
                onChange({ ...work, characters: [...work.characters, { id: newId('c'), name: '', intro: '' }] })
              }
            >
              + 추가
            </button>
          </h3>
          {work.characters.map((c, i) => (
            <div className="row" key={c.id}>
              <input
                placeholder="이름"
                value={c.name}
                onChange={(e) =>
                  onChange({
                    ...work,
                    characters: work.characters.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
              <input
                className="grow"
                placeholder="한 줄 소개"
                value={c.intro}
                onChange={(e) =>
                  onChange({
                    ...work,
                    characters: work.characters.map((x, idx) => (idx === i ? { ...x, intro: e.target.value } : x)),
                  })
                }
              />
              <button
                className="mini danger"
                onClick={() => onChange({ ...work, characters: work.characters.filter((_, idx) => idx !== i) })}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* 에피소드 */}
        <div className="section">
          <h3>
            회차
            <button
              className="mini"
              onClick={() =>
                onChange({ ...work, episodes: [...work.episodes, emptyEpisode(work.episodes.length + 1)] })
              }
            >
              + 추가
            </button>
          </h3>
          {work.episodes.map((ep: Episode) => {
            const errs = validateEpisode(ep).filter((i) => i.level === 'error').length;
            return (
              <div className="work-row" key={ep.id}>
                <button className="work-open" onClick={() => onOpenEpisode(ep.id)}>
                  <span className="t">
                    {ep.index}화 · {ep.title}
                  </span>
                  <span className="d">
                    노드 {ep.nodes.length}개{errs > 0 ? ` · 오류 ${errs}건` : ''}
                  </span>
                </button>
                <button className="mini" onClick={() => onPreview(ep.index)}>
                  이 화부터
                </button>
                <button
                  className="mini danger"
                  disabled={work.episodes.length <= 1}
                  onClick={() => onChange({ ...work, episodes: work.episodes.filter((e) => e.id !== ep.id) })}
                >
                  삭제
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
