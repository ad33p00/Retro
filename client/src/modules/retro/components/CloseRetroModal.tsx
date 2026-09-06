import type { SprintOption } from "../lib/types";

function formatSprintDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface CloseRetroModalProps {
  sprints: SprintOption[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  closing: boolean;
  error: string | null;
}

export function CloseRetroModal({
  sprints,
  loading,
  selectedId,
  onSelect,
  onConfirm,
  onCancel,
  closing,
  error,
}: CloseRetroModalProps) {
  const canConfirm = !loading && !closing && (sprints.length === 0 || Boolean(selectedId));

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Close this retro?</h2>
        <p className="subtitle">It becomes read-only for everyone and can't be reopened.</p>

        {loading ? (
          <p className="modal-loading">Loading sprints...</p>
        ) : sprints.length > 0 ? (
          <label className="modal-field">
            Which sprint is this export for?
            <select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)} autoFocus>
              <option value="" disabled>
                Select a sprint...
              </option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? " (current)" : ""}
                  {s.startDate && s.dueDate
                    ? ` — ${formatSprintDate(s.startDate)} to ${formatSprintDate(s.dueDate)}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="modal-loading">No sprints found — closing without a ClickUp export.</p>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={closing}>
            Cancel
          </button>
          <button type="button" className="close-retro-btn" onClick={onConfirm} disabled={!canConfirm}>
            {closing ? "Closing..." : "Close retro"}
          </button>
        </div>
      </div>
    </div>
  );
}
