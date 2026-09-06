import { request, requestVoid } from "../../../lib/http";
import type { ActionItem, Board, BoardState, BoardSummary, Card, Group, Participant, SprintOption, TemplateDef, Vote } from "./types";

export function fetchTemplates(): Promise<TemplateDef[]> {
  return request("/retro/boards/templates");
}

export function fetchBoards(): Promise<BoardSummary[]> {
  return request("/retro/boards");
}

export interface CreateBoardInput {
  name: string;
  template: string;
}

export function createBoard(input: CreateBoardInput): Promise<Board> {
  return request("/retro/boards", { method: "POST", body: JSON.stringify(input) });
}

export function fetchBoardState(boardId: string): Promise<BoardState> {
  return request(`/retro/boards/${boardId}`);
}

export function joinBoard(boardId: string, displayName: string | null): Promise<Participant> {
  return request(`/retro/boards/${boardId}/participants`, {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
}

export function fetchParticipant(boardId: string, participantId: string): Promise<Participant> {
  return request(`/retro/boards/${boardId}/participants/${participantId}`);
}

export function addCard(
  boardId: string,
  columnId: string,
  participantId: string,
  text: string
): Promise<Card> {
  return request(`/retro/boards/${boardId}/cards`, {
    method: "POST",
    body: JSON.stringify({ columnId, participantId, text }),
  });
}

export function editCard(
  boardId: string,
  cardId: string,
  participantId: string,
  text: string
): Promise<Card> {
  return request(`/retro/boards/${boardId}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ participantId, text }),
  });
}

export function moveCard(boardId: string, cardId: string, columnId: string): Promise<Card> {
  return request(`/retro/boards/${boardId}/cards/${cardId}/move`, {
    method: "PATCH",
    body: JSON.stringify({ columnId }),
  });
}

export function groupCards(boardId: string, cardId: string, targetCardId: string): Promise<Card[]> {
  return request(`/retro/boards/${boardId}/cards/${cardId}/group`, {
    method: "PATCH",
    body: JSON.stringify({ targetCardId }),
  });
}

export function ungroupCard(boardId: string, cardId: string): Promise<Card[]> {
  return request(`/retro/boards/${boardId}/cards/${cardId}/group`, { method: "DELETE" });
}

export function renameGroup(boardId: string, groupId: string, name: string): Promise<Group> {
  return request(`/retro/boards/${boardId}/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteCard(boardId: string, cardId: string, participantId: string): Promise<void> {
  return requestVoid(`/retro/boards/${boardId}/cards/${cardId}?participantId=${encodeURIComponent(participantId)}`, {
    method: "DELETE",
  });
}

export function castVote(boardId: string, cardId: string, participantId: string): Promise<Vote> {
  return request(`/retro/boards/${boardId}/cards/${cardId}/votes`, {
    method: "POST",
    body: JSON.stringify({ participantId }),
  });
}

export function retractVote(boardId: string, cardId: string, participantId: string): Promise<{ id: string }> {
  return request(
    `/retro/boards/${boardId}/cards/${cardId}/votes?participantId=${encodeURIComponent(participantId)}`,
    { method: "DELETE" }
  );
}

export function setLocked(boardId: string, participantId: string, locked: boolean): Promise<Board> {
  return request(`/retro/boards/${boardId}/lock`, {
    method: "PATCH",
    body: JSON.stringify({ participantId, locked }),
  });
}

export function startTimer(boardId: string, participantId: string, durationSeconds: number): Promise<Board> {
  return request(`/retro/boards/${boardId}/timer/start`, {
    method: "POST",
    body: JSON.stringify({ participantId, durationSeconds }),
  });
}

export function stopTimer(boardId: string, participantId: string): Promise<Board> {
  return request(`/retro/boards/${boardId}/timer/stop`, {
    method: "POST",
    body: JSON.stringify({ participantId }),
  });
}

export function addActionItem(boardId: string, text: string, assignee: string | null): Promise<ActionItem> {
  return request(`/retro/boards/${boardId}/action-items`, {
    method: "POST",
    body: JSON.stringify({ text, assignee }),
  });
}

export interface ActionItemUpdate {
  text?: string;
  assignee?: string | null;
  status?: "todo" | "done";
}

export function updateActionItem(boardId: string, itemId: string, update: ActionItemUpdate): Promise<ActionItem> {
  return request(`/retro/boards/${boardId}/action-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

export function deleteActionItem(boardId: string, itemId: string): Promise<void> {
  return requestVoid(`/retro/boards/${boardId}/action-items/${itemId}`, { method: "DELETE" });
}

export function closeBoard(boardId: string, participantId: string, clickupListId?: string): Promise<Board> {
  return request(`/retro/boards/${boardId}/close`, {
    method: "POST",
    body: JSON.stringify({ participantId, clickupListId }),
  });
}

export function fetchClickupSprints(): Promise<SprintOption[]> {
  return request("/retro/sprints");
}
