import { useState } from "react";

interface NamePromptProps {
  boardName: string;
  onSubmit: (name: string) => void;
  submitting: boolean;
}

export function NamePrompt({ boardName, onSubmit, submitting }: NamePromptProps) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  }

  return (
    <div className="page page-narrow">
      <h1>{boardName}</h1>
      <p className="subtitle">Enter your name to join this retro.</p>
      <form onSubmit={handleSubmit} className="card-form">
        <label>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jamie"
            autoFocus
            required
          />
        </label>
        <button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Joining..." : "Join board"}
        </button>
      </form>
    </div>
  );
}
