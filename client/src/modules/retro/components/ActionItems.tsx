import { useEffect, useState } from "react";
import type { ActionItem } from "../lib/types";

interface ActionItemRowProps {
  item: ActionItem;
  readOnly: boolean;
  onUpdateText: (text: string) => void;
  onUpdateAssignee: (assignee: string | null) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function ActionItemRow({ item, readOnly, onUpdateText, onUpdateAssignee, onToggleStatus, onDelete }: ActionItemRowProps) {
  const [text, setText] = useState(item.text);
  const [assignee, setAssignee] = useState(item.assignee ?? "");

  useEffect(() => setText(item.text), [item.text]);
  useEffect(() => setAssignee(item.assignee ?? ""), [item.assignee]);

  return (
    <div className="ai-row">
      <input
        className="ai-text"
        value={text}
        maxLength={280}
        disabled={readOnly}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const trimmed = text.trim();
          if (trimmed && trimmed !== item.text) onUpdateText(trimmed);
          else setText(item.text);
        }}
      />
      <input
        className="ai-assignee"
        value={assignee}
        placeholder="Assignee"
        maxLength={60}
        disabled={readOnly}
        onChange={(e) => setAssignee(e.target.value)}
        onBlur={() => {
          const trimmed = assignee.trim();
          if (trimmed !== (item.assignee ?? "")) onUpdateAssignee(trimmed || null);
        }}
      />
      <button
        type="button"
        className={item.status === "done" ? "status-chip done" : "status-chip todo"}
        onClick={onToggleStatus}
        disabled={readOnly}
      >
        {item.status === "done" ? "Done" : "To do"}
      </button>
      {!readOnly && (
        <button type="button" className="ai-delete" onClick={onDelete} aria-label="Delete action item">
          ✕
        </button>
      )}
    </div>
  );
}

interface ActionItemsProps {
  items: ActionItem[];
  readOnly: boolean;
  onAdd: (text: string, assignee: string | null) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateAssignee: (id: string, assignee: string | null) => void;
  onToggleStatus: (id: string, status: "todo" | "done") => void;
  onDelete: (id: string) => void;
}

export function ActionItems({
  items,
  readOnly,
  onAdd,
  onUpdateText,
  onUpdateAssignee,
  onToggleStatus,
  onDelete,
}: ActionItemsProps) {
  const [newText, setNewText] = useState("");
  const [newAssignee, setNewAssignee] = useState("");

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    onAdd(newText.trim(), newAssignee.trim() || null);
    setNewText("");
    setNewAssignee("");
  }

  return (
    <section className="action-items">
      <h3>Action items</h3>

      {items.length === 0 && <p className="action-items-empty">No action items yet.</p>}

      {items.map((item) => (
        <ActionItemRow
          key={item.id}
          item={item}
          readOnly={readOnly}
          onUpdateText={(text) => onUpdateText(item.id, text)}
          onUpdateAssignee={(assignee) => onUpdateAssignee(item.id, assignee)}
          onToggleStatus={() => onToggleStatus(item.id, item.status === "done" ? "todo" : "done")}
          onDelete={() => onDelete(item.id)}
        />
      ))}

      {!readOnly && (
        <form className="ai-add-form" onSubmit={submitNew}>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add an action item..."
            maxLength={280}
          />
          <input
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            placeholder="Assignee (optional)"
            maxLength={60}
          />
          <button type="submit" disabled={!newText.trim()}>
            Add
          </button>
        </form>
      )}
    </section>
  );
}
