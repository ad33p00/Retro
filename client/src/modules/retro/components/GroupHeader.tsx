import { useEffect, useState } from "react";

interface GroupHeaderProps {
  name: string;
  memberCount: number;
  combinedVotes: number;
  readOnly: boolean;
  onRename: (name: string) => void;
}

const MAX_LENGTH = 60;

export function GroupHeader({ name, memberCount, combinedVotes, readOnly, onRename }: GroupHeaderProps) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed !== name) onRename(trimmed);
  }

  return (
    <div className="card-group-header">
      <input
        className="card-group-name"
        value={draft}
        placeholder="Name this group..."
        maxLength={MAX_LENGTH}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="card-group-meta">
        {memberCount} notes · {combinedVotes} vote{combinedVotes === 1 ? "" : "s"}
      </span>
    </div>
  );
}
