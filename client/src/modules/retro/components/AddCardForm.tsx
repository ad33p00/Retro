import { useState } from "react";

interface AddCardFormProps {
  onAdd: (text: string) => void;
  disabled: boolean;
}

const MAX_LENGTH = 280;

export function AddCardForm({ onAdd, disabled }: AddCardFormProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (disabled) return null;

  if (!open) {
    return (
      <button type="button" className="add-card-ghost" onClick={() => setOpen(true)}>
        + Add a card
      </button>
    );
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
    setOpen(false);
  }

  return (
    <div className="sticky-edit add-card-open">
      <textarea
        value={text}
        maxLength={MAX_LENGTH}
        placeholder="What's on your mind?"
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="sticky-edit-actions">
        <span className="char-count">{text.length}/{MAX_LENGTH}</span>
        <button
          type="button"
          onClick={() => {
            setText("");
            setOpen(false);
          }}
        >
          Cancel
        </button>
        <button type="button" className="primary" onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}
