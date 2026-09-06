import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import type { Card, Participant } from "../lib/types";

interface CardItemProps {
  card: Card;
  author: Participant | undefined;
  canModify: boolean;
  voteCount: number;
  voterNames: string[];
  isAuthor: boolean;
  hasVoted: boolean;
  isGrouped: boolean;
  readOnly: boolean;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onVote: () => void;
  onUnvote: () => void;
  onUngroup: () => void;
}

const MAX_LENGTH = 280;

export function CardItem({
  card,
  author,
  canModify,
  voteCount,
  voterNames,
  isAuthor,
  hasVoted,
  isGrouped,
  readOnly,
  onEdit,
  onDelete,
  onVote,
  onUnvote,
  onUngroup,
}: CardItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: editing || readOnly,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `card:${card.id}` });

  function setRefs(node: HTMLDivElement | null) {
    setDragRef(node);
    setDropRef(node);
  }

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }
    : undefined;

  function startEdit() {
    setDraft(card.text);
    setEditing(true);
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== card.text) onEdit(trimmed);
    setEditing(false);
  }

  return (
    <div
      ref={setRefs}
      style={style}
      className={`sticky-card${isOver ? " drop-target-over" : ""}`}
      {...attributes}
      {...listeners}
    >
      {editing ? (
        <div className="sticky-edit" onPointerDown={(e) => e.stopPropagation()}>
          <textarea
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="sticky-edit-actions">
            <span className="char-count">{draft.length}/{MAX_LENGTH}</span>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" onClick={saveEdit} className="primary">
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="sticky-text">{card.text}</p>
          <div className="sticky-foot">
            <span className="sticky-author">
              <span className="dot" style={{ backgroundColor: author?.color ?? "#999" }} />
              {author?.display_name ?? "Anonymous"}
            </span>
            <span className="vote-controls" onPointerDown={(e) => e.stopPropagation()}>
              <span className="vote-tooltip-wrapper">
                <span className="vote-chip">● {voteCount}</span>
                <span className="vote-tooltip">{voterNames.length ? voterNames.join(", ") : "No votes yet"}</span>
              </span>
              {!isAuthor && !readOnly && (
                <button
                  type="button"
                  className={hasVoted ? "vote-toggle voted" : "vote-toggle"}
                  onClick={hasVoted ? onUnvote : onVote}
                >
                  {hasVoted ? "Voted" : "Vote"}
                </button>
              )}
            </span>
            <span className="sticky-actions" onPointerDown={(e) => e.stopPropagation()}>
              {isGrouped && !readOnly && (
                <button type="button" onClick={onUngroup}>
                  Ungroup
                </button>
              )}
              {canModify && (
                <>
                  <button type="button" onClick={startEdit}>
                    Edit
                  </button>
                  <button type="button" onClick={onDelete}>
                    Delete
                  </button>
                </>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
