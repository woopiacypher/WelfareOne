import { useEffect, useRef, useState } from "react";
import { CONFIRM_DELETE_ONE, HISTORY_RENAME_HINT, HISTORY_RENAME_INPUT_LABEL, historyRenameLabel } from "../../constants/text";
import { CUSTOM_TITLE_MAX_LENGTH } from "../../storage/history";
import type { ServerSessionSummary } from "../../api/history";

const DAY_MS = 24 * 60 * 60 * 1000;

function groupLabel(updatedAt: string, now: number): string {
  const date = new Date(updatedAt);
  const today = new Date(now);
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - date.getTime()) / DAY_MS);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days <= 7) return "최근 7일";
  return "이전";
}

interface Props {
  sessions: ServerSessionSummary[];
  activeId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ServerConversationList({ sessions, activeId, disabled, onSelect, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  const groups: { label: string; items: ServerSessionSummary[] }[] = [];

  for (const item of sessions) {
    const label = groupLabel(item.updated_at, Date.now());
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  useEffect(() => {
    if (editingId) {
      finished.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  const startEdit = (id: string, title: string) => {
    setError(null);
    setDraft(title);
    setEditingId(id);
  };
  const commit = async () => {
    if (finished.current || editingId === null) return;
    finished.current = true;
    const target = sessions.find((item) => item.session_id === editingId);
    const id = editingId;
    setEditingId(null);
    if (target && draft.trim() !== target.title) {
      try {
        await onRename(id, draft);
      } catch {
        setError("제목을 수정하지 못했어요. 다시 시도해 주세요.");
      }
    }
  };
  const cancel = () => {
    finished.current = true;
    setEditingId(null);
  };

  return (
    <nav className="history" aria-label="클라우드 상담 기록">
      {sessions.length === 0 ? (
        <p className="muted history-empty">저장된 상담 기록이 없습니다.</p>
      ) : (
        groups.map((group) => (
          <section key={group.label}>
            <h2 className="history-heading">{group.label}</h2>
            <ul className="history-list">
              {group.items.map((item) => {
                const active = item.session_id === activeId;
                if (item.session_id === editingId) {
                  return (
                    <li key={item.session_id} className={`history-item editing${active ? " active" : ""}`}>
                      <input
                        ref={inputRef}
                        className="history-rename-input"
                        value={draft}
                        maxLength={CUSTOM_TITLE_MAX_LENGTH}
                        aria-label={HISTORY_RENAME_INPUT_LABEL}
                        placeholder={HISTORY_RENAME_HINT}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => void commit()}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) return;
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commit();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancel();
                          }
                        }}
                      />
                    </li>
                  );
                }
                return (
                  <li key={item.session_id} className={`history-item${active ? " active" : ""}`}>
                    <button
                      type="button"
                      className="history-open"
                      disabled={disabled}
                      aria-current={active ? "true" : undefined}
                      title={item.title}
                      onClick={() => onSelect(item.session_id)}
                    >
                      <span className="history-title">{item.title}</span>
                      <span className="history-meta">
                        {item.region_level1} {item.region_level2}{item.age === null ? "" : ` · ${item.age}세`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="history-edit"
                      aria-label={historyRenameLabel(item.title)}
                      title="제목 수정"
                      onClick={() => startEdit(item.session_id, item.title)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="history-delete"
                      disabled={disabled}
                      aria-label={`${item.title} 상담 기록 삭제`}
                      onClick={async () => {
                        if (!window.confirm(CONFIRM_DELETE_ONE)) return;
                        setError(null);
                        try {
                          await onDelete(item.session_id);
                        } catch {
                          setError("상담 기록을 삭제하지 못했어요. 다시 시도해 주세요.");
                        }
                      }}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {error && <p className="warning" role="alert">{error}</p>}
    </nav>
  );
}
