function key(boardId: string): string {
  return `retro:participant:${boardId}`;
}

export function getStoredParticipantId(boardId: string): string | null {
  return sessionStorage.getItem(key(boardId));
}

export function setStoredParticipantId(boardId: string, participantId: string): void {
  sessionStorage.setItem(key(boardId), participantId);
}
