export interface BoardHistoryEntry {
  id: string;
  name: string;
  visitedAt: number;
}

const KEY = "retro:board-history";
const MAX_ENTRIES = 100;

export function getBoardHistory(): BoardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordBoardVisit(id: string, name: string): void {
  try {
    const history = getBoardHistory().filter((entry) => entry.id !== id);
    history.unshift({ id, name, visitedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX_ENTRIES)));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — history just won't persist.
  }
}

export function removeBoardFromHistory(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getBoardHistory().filter((entry) => entry.id !== id)));
  } catch {
    // ignore
  }
}
