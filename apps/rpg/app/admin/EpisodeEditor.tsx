'use client';

import { useMemo, useState } from 'react';
import { emptyNode } from '@/lib/authoring';
import { validateEpisode } from '@/lib/engine';
import type { Episode, StoryNode, Work } from '@/lib/types';
import NodeForm from './NodeForm';

interface Props {
  work: Work;
  episode: Episode;
  onChange: (episode: Episode) => void;
  onBack: () => void;
  onPreview: () => void;
}

export default function EpisodeEditor({ work, episode, onChange, onBack, onPreview }: Props) {
  const [selected, setSelected] = useState<string>(episode.entry);

  const issues = useMemo(() => validateEpisode(episode), [episode]);
  const issuesByNode = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of issues) map.set(i.nodeId, (map.get(i.nodeId) ?? 0) + 1);
    return map;
  }, [issues]);

  const node = episode.nodes.find((n) => n.id === selected) ?? episode.nodes[0];

  const setNode = (next: StoryNode) => {
    onChange({ ...episode, nodes: episode.nodes.map((n) => (n.id === next.id ? next : n)) });
  };

  const addNode = () => {
    const n = emptyNode();
    onChange({ ...episode, nodes: [...episode.nodes, n] });
    setSelected(n.id);
  };

  const deleteNode = (id: string) => {
    // 이 노드를 가리키던 선택지는 시작 노드로 되돌린다 — 끊긴 링크를 만들지 않는다
    const nodes = episode.nodes
      .filter((n) => n.id !== id)
      .map((n) => ({ ...n, choices: n.choices.map((c) => (c.next === id ? { ...c, next: episode.entry } : c)) }));
    onChange({ ...episode, nodes });
    setSelected(episode.entry);
  };

  return (
    <div className="admin-wide">
      <div className="admin-bar">
        <button className="mini" onClick={onBack}>
          ← 작품
        </button>
        <strong>{episode.title}</strong>
        <span className="spacer" />
        <span className={`issue-count${issues.some((i) => i.level === 'error') ? ' bad' : ''}`}>
          {issues.length === 0 ? '문제 없음' : `${issues.length}건`}
        </span>
        <button className="mini primary" onClick={onPreview}>
          미리보기
        </button>
      </div>

      <div className="ep-meta">
        <label className="field inline">
          <span>화수</span>
          <input
            type="number"
            value={episode.index}
            onChange={(e) => onChange({ ...episode, index: Number(e.target.value) })}
          />
        </label>
        <label className="field inline grow">
          <span>제목</span>
          <input value={episode.title} onChange={(e) => onChange({ ...episode, title: e.target.value })} />
        </label>
        <label className="field inline grow">
          <span>이전 화 요약 (recap)</span>
          <input
            value={episode.recap ?? ''}
            onChange={(e) => onChange({ ...episode, recap: e.target.value || undefined })}
          />
        </label>
      </div>

      {issues.length > 0 ? (
        <ul className="issues">
          {issues.map((i, idx) => (
            <li key={idx} className={i.level}>
              <button className="linkish" onClick={() => setSelected(i.nodeId)}>
                {i.nodeId}
              </button>{' '}
              {i.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="editor-panes">
        <aside className="node-list">
          <button className="mini primary block" onClick={addNode}>
            + 노드
          </button>
          {episode.nodes.map((n) => (
            <button
              key={n.id}
              className={`node-item${n.id === node?.id ? ' on' : ''}`}
              onClick={() => setSelected(n.id)}
            >
              <span className="nl-id">
                {n.id === episode.entry ? '▶ ' : ''}
                {n.id}
                {n.ending ? ` · ${n.ending.kind}` : ''}
              </span>
              <span className="nl-text">{n.speaker ? `${n.speaker}: ` : ''}{n.text.slice(0, 40) || '(빈 노드)'}</span>
              {issuesByNode.has(n.id) ? <span className="nl-warn">{issuesByNode.get(n.id)}</span> : null}
            </button>
          ))}
        </aside>

        <section className="node-pane">
          {node ? (
            <NodeForm
              work={work}
              episode={episode}
              node={node}
              onChange={setNode}
              onDelete={() => deleteNode(node.id)}
              isEntry={node.id === episode.entry}
              onMakeEntry={() => onChange({ ...episode, entry: node.id })}
            />
          ) : (
            <p className="hint-line">노드를 선택하세요.</p>
          )}
        </section>
      </div>
    </div>
  );
}
