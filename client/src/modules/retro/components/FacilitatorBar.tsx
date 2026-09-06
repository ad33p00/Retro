import { useEffect, useState } from "react";
import type { Board } from "../lib/types";

interface FacilitatorBarProps {
  board: Board;
  isFacilitator: boolean;
  onToggleLock: () => void;
  onStartTimer: (minutes: number) => void;
  onStopTimer: () => void;
  onClose: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function FacilitatorBar({
  board,
  isFacilitator,
  onToggleLock,
  onStartTimer,
  onStopTimer,
  onClose,
}: FacilitatorBarProps) {
  const [now, setNow] = useState(Date.now());
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    if (!board.timer_ends_at) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [board.timer_ends_at]);

  if (board.completed_at) {
    return (
      <div className="facilitator-bar">
        <span className="closed-badge">✓ This retro is closed</span>
      </div>
    );
  }

  const remainingMs = board.timer_ends_at ? board.timer_ends_at - now : null;
  const timerRunning = remainingMs !== null && remainingMs > 0;

  return (
    <div className="facilitator-bar">
      <div className="facilitator-controls">
        {timerRunning && <span className="timer-chip">⏱ {formatRemaining(remainingMs!)}</span>}

        {isFacilitator && (
          <>
            {timerRunning ? (
              <button type="button" onClick={onStopTimer}>
                Stop timer
              </button>
            ) : (
              <span className="timer-start">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
                <span className="timer-start-label">min</span>
                <button type="button" onClick={() => onStartTimer(minutes)}>
                  Start timer
                </button>
              </span>
            )}
            <button type="button" onClick={onToggleLock}>
              {board.locked ? "Unlock adding cards" : "Lock adding cards"}
            </button>
            <button type="button" className="close-retro-btn" onClick={onClose}>
              Close retro
            </button>
          </>
        )}

        {!isFacilitator && Boolean(board.locked) && <span className="lock-indicator">🔒 Adding cards is locked</span>}
      </div>
    </div>
  );
}
