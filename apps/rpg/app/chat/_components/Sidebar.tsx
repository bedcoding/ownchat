'use client';

import type { Conversation } from '@/lib/chat/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  /** 좁은 화면에서는 서랍으로 열린다. 넓은 화면에서는 이 값과 무관하게 항상 보인다 */
  open: boolean;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  open,
}: Props) {
  return (
    <aside className="sidebar" data-open={open}>
      <div className="sidebar-head">
        <p className="brand">ownchat</p>
        <p className="brand-sub">내 계정으로 쓰는 AI 채팅</p>
      </div>

      <div className="conv-list">
        {conversations.length === 0 ? (
          <p className="brand-sub" style={{ padding: '8px 10px' }}>
            아직 대화가 없습니다.
          </p>
        ) : (
          conversations.map((conv) => (
            <div className="conv-row" key={conv.id}>
              <button
                type="button"
                className="conv-item"
                aria-current={conv.id === activeId}
                onClick={() => onSelect(conv.id)}
                title={conv.title}
              >
                {conv.title}
              </button>
              <button
                type="button"
                className="conv-del"
                aria-label={`${conv.title} 삭제`}
                onClick={() => onDelete(conv.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-foot">
        <button type="button" className="btn" onClick={onNew}>
          새 대화
        </button>
        <button type="button" className="btn ghost" onClick={onOpenSettings}>
          설정
        </button>
      </div>
    </aside>
  );
}
